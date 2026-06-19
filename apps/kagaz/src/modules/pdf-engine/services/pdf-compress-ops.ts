import { loadAndValidatePdf, imagesToPdfImpl } from './pdf-ops';
import { pdfToImagesImpl } from './pdf-render-ops';
import {
  type CompressionLevel,
  type ImageInput,
  type ProgressCallback,
  PdfEngineException,
} from '../types/pdf-engine.types';

/**
 * PDF compression (F-5) by rasterise-and-rebuild: render each page to a JPEG
 * (pdfjs) at a quality-dependent DPI, then rebuild a PDF from those images
 * (pdf-lib). Fully offline, MIT-licensed, no WASM/CDN — chosen deliberately:
 * the better text-preserving compressors are either AGPL (MuPDF, Ghostscript —
 * forbidden for this proprietary app) or network/CDN + WASM-eval dependent
 * (`@quicktoolsone/pdf-compress`, which fails on the zero-network app and would
 * need an `unsafe-eval` CSP). See ADR-017 / CLAUDE.md media-library rule.
 *
 * Trade-off: lossy (text becomes raster) — acceptable because compression is
 * mostly run on scans/photos, where it shrinks the most. Runs on the MAIN
 * thread (pdfjs + canvas), like F-6 render. A commercial MuPDF licence is the
 * upgrade path if lossless text compression ever becomes a requirement.
 */

/** Render scale (≈DPI/72) + JPEG quality per level. Lower level → smaller. */
const SETTINGS: Record<CompressionLevel, { scale: number; quality: number }> = {
  high: { scale: 1.6, quality: 0.82 },
  medium: { scale: 1.3, quality: 0.68 },
  low: { scale: 1.0, quality: 0.5 },
};

/** Compresses `pdf` by rasterising each page and rebuilding the document. */
export async function compressPdfImpl(
  pdf: Uint8Array,
  quality: CompressionLevel,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'compressPdf';
  await loadAndValidatePdf(pdf, op); // reject non-PDFs up front

  const { scale, quality: jpegQuality } = SETTINGS[quality];
  try {
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
    const result = await imagesToPdfImpl(images);
    onProgress?.({
      operationId: 'compress',
      operation: op,
      percent: 100,
      message: 'Done',
    });
    return result;
  } catch (e: unknown) {
    if (e instanceof PdfEngineException) {
      throw e;
    }
    const error = e instanceof Error ? e : new Error(String(e));
    throw new PdfEngineException(
      `Compression failed: ${error.message}`,
      'COMPRESSION_FAILED',
      op,
      error
    );
  }
}
