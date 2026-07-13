/**
 * Scanned-PDF OCR fallback (F-20 follow-up). A PDF with no embedded text layer
 * (a scan/photo saved as PDF) yields nothing from pdfjs `getTextContent`, so we
 * render its pages to images and run each through the native ML Kit recogniser.
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

/** Everything {@link ocrScannedPdf} needs, injected. */
export interface PdfOcrDeps {
  /** Renders every PDF page to an image blob (e.g. pdf-engine's pdfToImages). */
  renderPages: (pdf: Uint8Array) => Promise<Blob[]>;
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

/**
 * OCRs a scanned PDF page-by-page and returns the combined text (blank when
 * nothing is found). Each page image lives in temp/ only while ML Kit reads it.
 */
export async function ocrScannedPdf(
  pdf: Uint8Array,
  language: SupportedLanguage,
  deps: PdfOcrDeps
): Promise<string> {
  const newId = deps.uuid ?? ((): string => crypto.randomUUID());
  const blobs = await deps.renderPages(pdf);
  const pages: string[] = [];

  for (const blob of blobs) {
    const path = `${STORAGE_DIRS.temp}/pdf-ocr-${newId()}.png`;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await deps.storage.write(path, bytes);
    try {
      const text = await deps.recognize(path, language);
      if (text.trim()) {
        pages.push(text.trim());
      }
    } finally {
      await deps.storage.delete(path).catch(() => undefined);
    }
  }

  return pages.join('\n\n').trim();
}
