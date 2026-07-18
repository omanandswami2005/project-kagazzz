/**
 * Image Engine types (04-image-engine-module.md §5–6). V1 scope is format
 * conversion (F-8): detect any common image format from its magic bytes,
 * and convert among the Canvas-native formats (JPEG/PNG/WebP). BMP/TIFF/
 * GIF are detect-only for now; HEIC decoding is handled natively by the
 * OS at camera capture (no bundled LGPL decoder — see ADR-016).
 */

/** Image formats we can recognise from binary headers. */
export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'bmp'
  | 'tiff'
  | 'heic'
  | 'gif';

/** Formats we can both decode and encode in the WebView via Canvas. */
export const CANVAS_FORMATS: readonly ImageFormat[] = ['jpeg', 'png', 'webp'];

/** Canvas-native formats that {@link ImageFormat} conversion can target. */
export type CanvasFormat = 'jpeg' | 'png' | 'webp';

/** MIME type for each format. */
export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  heic: 'image/heic',
  gif: 'image/gif',
};

/** Basic metadata read from an image blob. */
export interface ImageInfo {
  /** Pixel width. */
  width: number;
  /** Pixel height. */
  height: number;
  /** Detected format (from magic bytes), or null if unrecognised. */
  format: ImageFormat | null;
  /** File size in bytes. */
  fileSize: number;
  /** MIME type for the detected format, or the blob's own type. */
  mimeType: string;
}

/** Machine-readable failure codes for image operations. */
export type ImageErrorCode =
  | 'INVALID_IMAGE'
  | 'UNSUPPORTED_FORMAT'
  | 'CONVERSION_FAILED'
  | 'CANVAS_ERROR';

/** A typed image-operation failure. */
export class ImageEngineError extends Error {
  readonly code: ImageErrorCode;
  readonly operation: string;

  constructor(code: ImageErrorCode, operation: string, message: string) {
    super(message);
    this.name = 'ImageEngineError';
    this.code = code;
    this.operation = operation;
  }
}
