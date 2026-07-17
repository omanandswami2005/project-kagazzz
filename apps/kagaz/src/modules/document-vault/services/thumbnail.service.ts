/**
 * Thumbnail generation (02-document-vault-module.md §Document Thumbnails,
 * P0-5 note: lands with F-24). Produces a small JPEG preview for images
 * and PDF first pages, cached under thumbnails/. The actual canvas/pdfjs
 * rendering is injected so the dispatch + sizing logic stays unit-testable
 * (canvas and pdfjs do not run in jsdom — they are device-verified).
 */
import { FileType } from '../types/document.types';

/** Longest edge of a generated thumbnail, in pixels. */
export const THUMBNAIL_MAX = 300;

/** JPEG quality for thumbnails (small files, good enough preview). */
export const THUMBNAIL_QUALITY = 0.7;

/** PDF type as a plain string (avoids string-vs-enum comparison). */
const PDF_TYPE: string = FileType.PDF;

/** File types we can render a thumbnail for. */
const THUMBNAILABLE: readonly string[] = [
  FileType.PDF,
  FileType.JPG,
  FileType.JPEG,
  FileType.PNG,
  FileType.WEBP,
];

/** True when a thumbnail can be generated for this stored file type. */
export function supportsThumbnail(fileType: string): boolean {
  return THUMBNAILABLE.includes(fileType);
}

/**
 * Scales (w, h) to fit within a `max`×`max` box, preserving aspect ratio
 * and never upscaling. Returns integer pixel dimensions ≥ 1.
 */
export function fitWithin(
  width: number,
  height: number,
  max: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Renders a source blob to a thumbnail blob (canvas/pdfjs); null = skip. */
export type ThumbnailRenderer = (blob: Blob) => Promise<Blob | null>;

/** Injectable renderers (tests pass fakes; runtime uses the defaults). */
export interface ThumbnailDeps {
  renderImage?: ThumbnailRenderer;
  renderPdf?: ThumbnailRenderer;
}

/**
 * Default image renderer: decode via createImageBitmap, draw scaled onto
 * a canvas, export JPEG. Browser/WebView only (no canvas in jsdom).
 */
const defaultRenderImage: ThumbnailRenderer = async (blob) => {
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = fitWithin(
      bitmap.width,
      bitmap.height,
      THUMBNAIL_MAX
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((out) => resolve(out), 'image/jpeg', THUMBNAIL_QUALITY)
    );
  } finally {
    bitmap.close();
  }
};

/**
 * Default PDF renderer: lazy-load pdfjs (keeps its ~700 KB worker out of
 * the main chunk, [PERF]) and rasterize page 1 to a thumbnail. WebView
 * only.
 */
const defaultRenderPdf: ThumbnailRenderer = async (blob) => {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_MAX / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    await page.render({ canvasContext: ctx, viewport }).promise;
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((out) => resolve(out), 'image/jpeg', THUMBNAIL_QUALITY)
    );
  } finally {
    await loadingTask.destroy();
  }
};

/**
 * Generates a thumbnail for the file, or null when unsupported or on any
 * rendering failure (the caller falls back to a generic icon — spec
 * §Error Handling: thumbnail failure is non-blocking).
 */
export async function generateThumbnail(
  blob: Blob,
  fileType: string,
  deps: ThumbnailDeps = {}
): Promise<Uint8Array | null> {
  if (!supportsThumbnail(fileType)) {
    return null;
  }
  const renderImage = deps.renderImage ?? defaultRenderImage;
  const renderPdf = deps.renderPdf ?? defaultRenderPdf;
  try {
    const out =
      fileType === PDF_TYPE ? await renderPdf(blob) : await renderImage(blob);
    if (!out) {
      return null;
    }
    return new Uint8Array(await out.arrayBuffer());
  } catch {
    return null;
  }
}
