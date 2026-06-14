import { compress } from '@quicktoolsone/pdf-compress';
import { loadAndValidatePdf, imagesToPdfImpl } from './pdf-ops';
import { pdfToImagesImpl } from './pdf-render-ops';
import {
  type CompressionLevel,
  type ImageInput,
  type ProgressCallback,
  PdfEngineException,
} from '../types/pdf-engine.types';

/** Library preset per quality level. */
const PRESET: Record<CompressionLevel, 'lossless' | 'balanced' | 'max'> = {
  high: 'lossless',
  medium: 'balanced',
  low: 'max',
};

/** Rasterise render settings per quality level (DPI scale + JPEG quality). */
const RASTERIZE: Record<CompressionLevel, { scale: number; quality: number }> = {
  high: { scale: 1.6, quality: 0.82 },
  medium: { scale: 1.3, quality: 0.68 },
  low: { scale: 1.0, quality: 0.5 },
};

/**
 * Compresses a PDF (F-5). Primary path is @quicktoolsone/pdf-compress (keeps
 * text/vectors lossless); but that library fails on some image-heavy PDFs in
 * the WebView, so on failure we fall back to a rasterise-and-rebuild
 * compressor (render each page to a JPEG, embed back into a PDF) — lossy, but
 * reliable and exactly what shrinks scans/photos. Runs on the main thread:
 * both libraries need a DOM canvas.
 */
export async function compressPdfImpl(
  pdf: Uint8Array,
  quality: CompressionLevel,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'compressPdf';
  await loadAndValidatePdf(pdf, op); // reject non-PDFs up front

  try {
    return await compressWithLibrary(pdf, quality, onProgress);
  } catch {
    try {
      return await compressByRasterize(pdf, quality, onProgress);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      throw new PdfEngineException(
        `Compression failed: ${error.message}`,
        'COMPRESSION_FAILED',
        op,
        error
      );
    }
  }
}

/** Primary compressor: @quicktoolsone/pdf-compress. */
async function compressWithLibrary(
  pdf: Uint8Array,
  quality: CompressionLevel,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  // Pass exactly the PDF bytes (a Uint8Array can be a view into a larger buffer).
  const input =
    pdf.byteOffset === 0 && pdf.byteLength === pdf.buffer.byteLength
      ? (pdf.buffer as ArrayBuffer)
      : pdf.slice().buffer;

  const result = await compress(input, {
    preset: PRESET[quality],
    onProgress: (event) => {
      onProgress?.({
        operationId: 'compress',
        operation: 'compressPdf',
        percent: event.progress,
        message: `Compressing… ${event.phase}`,
        currentStep: event.currentChunk,
        totalSteps: event.totalChunks,
      });
    },
  });
  onProgress?.({
    operationId: 'compress',
    operation: 'compressPdf',
    percent: 100,
    message: 'Done',
  });
  return new Uint8Array(result.pdf);
}

/** Fallback compressor: render each page to a JPEG, rebuild as a PDF. */
async function compressByRasterize(
  pdf: Uint8Array,
  quality: CompressionLevel,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const { scale, quality: jpegQuality } = RASTERIZE[quality];
  const pages = await pdfToImagesImpl(
    pdf,
    { format: 'jpeg', scale, quality: jpegQuality },
    onProgress
  );
  const images: ImageInput[] = await Promise.all(
    pages.map(async (blob) => ({
      data: new Uint8Array(await blob.arrayBuffer()),
      mimeType: 'image/jpeg',
    }))
  );
  return imagesToPdfImpl(images);
}
