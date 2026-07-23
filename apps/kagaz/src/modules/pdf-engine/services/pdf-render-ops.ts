import {
  type ProgressCallback,
  type RenderOptions,
  PdfEngineException,
} from '../types/pdf-engine.types';

/**
 * PDF → image rendering (F-6) via pdfjs-dist. Runs on the MAIN thread (with a
 * real canvas) — the same proven path the vault uses for thumbnails — because
 * pdfjs does not initialise reliably inside a Vite module worker, and its
 * rasterisation needs a canvas. WebView only (jsdom has no canvas).
 */

/**
 * Lazy-load pdfjs once and point it at its bundled worker (off the main
 * chunk). On WebView builds older than Chromium 119 (observed: WebView 113)
 * pdfjs never actually spawns that worker — it falls back to running its
 * worker code inline on the main thread ("fake worker" mode) — which is why
 * `core/polyfills/pdfjs-runtime-polyfills` (imported once in `main.tsx`) is
 * enough on its own; see that file's doc comment for the full story.
 */
let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null;
async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  pdfjsReady ??= (async (): Promise<typeof import('pdfjs-dist')> => {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url'))
      .default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  })();
  return pdfjsReady;
}

/**
 * Extracts the embedded text layer from a PDF, one entry per page (index
 * 0-based, in page order; a page with no text is `''`) via pdfjs
 * `getTextContent` — fast and OCR-free for PDFs that carry real text (most
 * generated/exported PDFs). Runs on the MAIN thread with pdfjs, but needs no
 * canvas, so it is lighter than rasterising. WebView/web only.
 *
 * Callers needing scan-vs-text detection **per page** (rather than for the
 * document as a whole) should use this instead of {@link extractPdfTextImpl}
 * — see `useDocumentOcr.ts` for why: a PDF can be scanned pages with a
 * stamped page-number/watermark (real, but tiny, vector text) on every page,
 * which makes the whole-document text non-empty even though no real content
 * was extracted from any page.
 *
 * [SEC] the returned text is document content — the caller stores it only in
 * the encrypted DB and never logs it.
 */
export async function extractPdfTextPerPageImpl(pdf: Uint8Array): Promise<string[]> {
  const op = 'extractPdfText';
  if (!pdf || pdf.length === 0) {
    throw new PdfEngineException('Empty or missing PDF data', 'INVALID_PDF', op);
  }

  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: pdf });
  let doc: Awaited<typeof loadingTask.promise>;
  try {
    doc = await loadingTask.promise;
  } catch (e: unknown) {
    await loadingTask.destroy().catch(() => undefined);
    const error = e instanceof Error ? e : new Error(String(e));
    throw new PdfEngineException(`Invalid PDF: ${error.message}`, 'INVALID_PDF', op, error);
  }

  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push(pageText);
    }
    return pages;
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

/**
 * The whole document's text layer as one string (UX-13) — pages joined in
 * order, blank pages dropped. For scan-vs-text detection use
 * {@link extractPdfTextPerPageImpl} instead; this is for callers that only
 * ever want "all the real text this PDF carries" (e.g. the standalone
 * Extract Text tool).
 */
export async function extractPdfTextImpl(pdf: Uint8Array): Promise<string> {
  const pages = await extractPdfTextPerPageImpl(pdf);
  return pages.filter((p) => p.length > 0).join('\n\n').trim();
}

/** Renders the requested pages of `pdf` to image blobs. */
export async function pdfToImagesImpl(
  pdf: Uint8Array,
  options: RenderOptions,
  onProgress?: ProgressCallback
): Promise<Blob[]> {
  const op = 'pdfToImages';
  if (!pdf || pdf.length === 0) {
    throw new PdfEngineException('Empty or missing PDF data', 'INVALID_PDF', op);
  }

  const pdfjs = await loadPdfjs();
  const scale = options.scale ?? 2;
  const mime = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = options.quality ?? 0.92;

  const loadingTask = pdfjs.getDocument({ data: pdf });
  let doc: Awaited<typeof loadingTask.promise>;
  try {
    doc = await loadingTask.promise;
  } catch (e: unknown) {
    await loadingTask.destroy().catch(() => undefined);
    const error = e instanceof Error ? e : new Error(String(e));
    throw new PdfEngineException(`Invalid PDF: ${error.message}`, 'INVALID_PDF', op, error);
  }

  try {
    const total = doc.numPages;
    // RenderOptions.pages are 0-indexed; pdfjs pages are 1-indexed.
    // Bug-audit fix: this used to silently drop any out-of-range page
    // instead of rejecting it, the one render op that didn't match
    // splitPdf/organizePages/stampImage's PAGE_OUT_OF_RANGE convention for
    // the same class of error — a "1,5" request on a 3-page PDF used to
    // quietly render just page 1 and report success, or (if every
    // requested page was out of range) return zero images with no
    // indication why.
    if (options.pages) {
      const outOfRange = options.pages.filter((p) => p < 0 || p + 1 > total);
      if (outOfRange.length > 0) {
        throw new PdfEngineException(
          `Page ${outOfRange[0] + 1} is out of range (1–${total})`,
          'PAGE_OUT_OF_RANGE',
          op
        );
      }
    }
    const pageNumbers =
      options.pages && options.pages.length > 0
        ? options.pages.map((p) => p + 1)
        : Array.from({ length: total }, (_, i) => i + 1);

    const blobs: Blob[] = [];
    for (let i = 0; i < pageNumbers.length; i++) {
      const page = await doc.getPage(pageNumbers[i]);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new PdfEngineException(
          'Canvas 2D context unavailable for rendering',
          'UNSUPPORTED_FORMAT',
          op
        );
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((out) => resolve(out), mime, quality)
      );
      if (!blob) {
        throw new PdfEngineException(
          'Failed to encode the rendered page',
          'UNSUPPORTED_FORMAT',
          op
        );
      }
      blobs.push(blob);
      onProgress?.({
        operationId: 'pdfToImages',
        operation: op,
        percent: Math.round(((i + 1) / pageNumbers.length) * 100),
        message: `Rendered page ${i + 1} of ${pageNumbers.length}`,
        currentStep: i + 1,
        totalSteps: pageNumbers.length,
      });
    }
    return blobs;
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}
