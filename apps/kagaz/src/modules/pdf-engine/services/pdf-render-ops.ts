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

/** Lazy-load pdfjs once and point it at its bundled worker (off the main chunk). */
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
    const pageNumbers =
      options.pages && options.pages.length > 0
        ? options.pages.map((p) => p + 1).filter((n) => n >= 1 && n <= total)
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
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
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
