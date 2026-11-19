/**
 * Per-type document facts (device feedback 2026-11-19): what a document *is*,
 * beyond name and size — a PDF's page count, title and author; an image's
 * pixel size. Stored under `facts` in the document's `metadata_json` column
 * (unused until now), filled at upload and backfilled the first time the
 * assistant asks, so the AI can plan ("split pages 1–3" needs to know there
 * are 5) without reading the document's content.
 *
 * [SEC] Metadata only (10-security-architecture §11's AI data boundary):
 * never page text, never OCR output.
 */
import { FileType } from '../types/document.types';

/** Facts about a PDF. `pages` is absent when the file is password-protected. */
export interface PdfFacts {
  kind: 'pdf';
  pages?: number;
  title?: string;
  author?: string;
  encrypted?: boolean;
}

/** Facts about a raster image. */
export interface ImageFacts {
  kind: 'image';
  width: number;
  height: number;
}

/** What {@link readDocumentFacts} can say about a document. */
export type DocumentFacts = PdfFacts | ImageFacts;

/** Reads a file's facts; null when the type has none or reading failed. */
export type FactsReader = (blob: Blob, fileType: string) => Promise<DocumentFacts | null>;

const IMAGE_TYPES: readonly string[] = [FileType.JPG, FileType.JPEG, FileType.PNG, FileType.WEBP];
const PDF_TYPE: string = FileType.PDF;
/** Longest title/author kept; PDF info fields can be arbitrarily long. */
const MAX_FIELD = 120;

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_FIELD) : undefined;
}

/** pdf.js (lazy, same as thumbnails): page count + info dictionary. */
async function readPdfFacts(blob: Blob): Promise<PdfFacts> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  try {
    const doc = await loadingTask.promise;
    const { info } = await doc.getMetadata().catch(() => ({ info: {} }));
    const fields = info as { Title?: unknown; Author?: unknown };
    return { kind: 'pdf', pages: doc.numPages, title: clean(fields.Title), author: clean(fields.Author) };
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'PasswordException') {
      return { kind: 'pdf', encrypted: true };
    }
    throw error;
  } finally {
    await loadingTask.destroy();
  }
}

async function readImageFacts(blob: Blob): Promise<ImageFacts> {
  const bitmap = await createImageBitmap(blob);
  try {
    return { kind: 'image', width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/** Default reader (WebView: pdf.js / createImageBitmap). Best-effort: null on failure. */
export const readDocumentFacts: FactsReader = async (blob, fileType) => {
  try {
    if (fileType === PDF_TYPE) return await readPdfFacts(blob);
    if (IMAGE_TYPES.includes(fileType)) return await readImageFacts(blob);
  } catch {
    // Unreadable or unsupported: the document simply has no facts yet.
  }
  return null;
};

function parseMetadata(metadataJson: string | undefined): Record<string, unknown> {
  if (!metadataJson) return {};
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The facts stored on a document, or null if none have been read yet. */
export function factsOf(doc: { metadataJson?: string }): DocumentFacts | null {
  const facts = parseMetadata(doc.metadataJson).facts as DocumentFacts | undefined;
  return facts && (facts.kind === 'pdf' || facts.kind === 'image') ? facts : null;
}

/** `metadataJson` with `facts` set, keeping any other keys already there. */
export function withFacts(metadataJson: string | undefined, facts: DocumentFacts): string {
  return JSON.stringify({ ...parseMetadata(metadataJson), facts });
}
