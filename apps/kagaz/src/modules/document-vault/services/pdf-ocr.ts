/**
 * Per-page OCR for PDF pages whose native text layer isn't trustworthy
 * (F-20 follow-up, 2026-07-21). A PDF with no embedded text at all (a
 * scan/photo saved as PDF) yields nothing from pdfjs `getTextContent` — but a
 * scanned PDF that also has a stamped page-number or watermark (real, but
 * tiny, vector text) yields a *non-empty* string per page even though no real
 * content was extracted, which previously fooled the whole-document
 * empty-text check in `useDocumentOcr.ts` into skipping OCR entirely. The
 * caller now decides per page (via `extractPdfTextPerPageImpl`) which pages
 * are "sparse" and passes only those page indices here to be rendered + OCR'd
 * — this file no longer decides scan-vs-text itself, only executes the OCR
 * for the pages it's told about.
 *
 * Native-only (ML Kit + a canvas renderer); the caller gates on `isOcrSupported`.
 * The renderer, recogniser, and temp storage are injected so the orchestration
 * is unit-testable without a device.
 *
 * [SEC] page images are written to temp/ only for the moment ML Kit reads them
 * and deleted immediately after; the recognised text is sensitive and is never
 * logged here (the caller stores it in the encrypted DB).
 */
import type { SupportedLanguage } from '@/core/i18n';
import { STORAGE_DIRS } from '@/infrastructure/filesystem';
import type { ImageTextRecognizer } from '@/modules/image-engine/services/vision-ocr.service';

/** Renders pages; shared by both recognition paths. */
interface PdfOcrBaseDeps {
  /** Renders the given 0-indexed pages of a PDF to image blobs, in order
   * (all pages when `pages` is omitted — e.g. pdf-engine's pdfToImages). */
  renderPages: (pdf: Uint8Array, pages?: number[]) => Promise<Blob[]>;
}

/** Native path: write each page to temp storage and read it with ML Kit. */
export interface PdfOcrNativeDeps extends PdfOcrBaseDeps {
  /** Recognises text in a stored (app-relative) image path via ML Kit. */
  recognize: (storagePath: string, language: SupportedLanguage) => Promise<string>;
  /** Temp file I/O (write a page image, delete it after). */
  storage: {
    write: (path: string, data: Uint8Array) => Promise<void>;
    delete: (path: string) => Promise<void>;
  };
  /** UUID generator (injected so tests are deterministic). */
  uuid?: () => string;
}

/** Fallback path (no ML Kit): hand each rendered page blob straight to a vision model. */
interface PdfOcrBlobDeps extends PdfOcrBaseDeps {
  recognizeImage: ImageTextRecognizer;
}

/** Everything {@link ocrPdfPages} needs, injected — one recognition path or the other. */
export type PdfOcrDeps = PdfOcrNativeDeps | PdfOcrBlobDeps;

/**
 * OCRs exactly the given 0-indexed `pageIndices` (rendered in that order) and
 * returns their recognised text in the same order — '' for a page where
 * nothing was recognised. Passing every page index reproduces the old
 * "OCR the whole scanned PDF" behavior; passing a subset lets the caller mix
 * trusted native text (for confident pages) with OCR (for sparse ones).
 */
export async function ocrPdfPages(
  pdf: Uint8Array,
  pageIndices: number[],
  language: SupportedLanguage,
  deps: PdfOcrDeps
): Promise<string[]> {
  if (pageIndices.length === 0) {
    return [];
  }
  const blobs = await deps.renderPages(pdf, pageIndices);
  const texts: string[] = [];

  if ('recognizeImage' in deps) {
    for (const blob of blobs) {
      texts.push((await deps.recognizeImage(blob)).trim());
    }
    return texts;
  }
  const newId = deps.uuid ?? ((): string => crypto.randomUUID());

  for (const blob of blobs) {
    const path = `${STORAGE_DIRS.temp}/pdf-ocr-${newId()}.png`;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await deps.storage.write(path, bytes);
    try {
      const text = await deps.recognize(path, language);
      texts.push(text.trim());
    } finally {
      await deps.storage.delete(path).catch(() => undefined);
    }
  }

  return texts;
}
