/**
 * Image Engine service — V1 format conversion (F-8,
 * 04-image-engine-module.md §4, §8). Converts among the Canvas-native
 * formats (JPEG/PNG/WebP) entirely on-device: zero bundle cost, no third-
 * party decoder, no network. The canvas decode/encode is injected so the
 * dispatch + validation logic is unit-testable (canvas does not run in
 * jsdom — the renderers are device-verified).
 *
 * HEIC: decoded natively by the OS at camera capture (@capacitor/camera
 * returns JPEG), so it never reaches here as HEIC. We deliberately bundle
 * no JS HEIC decoder — every one wraps libheif (LGPL-3.0), which the
 * project's permissive-only license policy forbids (ADR-016).
 */
import {
  CANVAS_FORMATS,
  FORMAT_MIME,
  ImageEngineError,
  type CanvasFormat,
  type ImageFormat,
  type ImageInfo,
} from '../types/image.types';
import { detectFormat } from './format-detector';

/** Default JPEG/WebP encode quality (0–1). */
export const DEFAULT_QUALITY = 0.92;

/** Encodes a blob to `mime` at `quality` via canvas; null = encode failed. */
export type ImageConverter = (
  blob: Blob,
  mime: string,
  quality: number
) => Promise<Blob | null>;

/** Reads pixel dimensions from a blob. */
export type ImageDecoder = (
  blob: Blob
) => Promise<{ width: number; height: number }>;

/** Injectable canvas operations (tests pass fakes; runtime uses defaults). */
export interface ImageEngineDeps {
  convert?: ImageConverter;
  decode?: ImageDecoder;
}

/** Decode → draw → encode through a canvas. WebView only (no jsdom canvas). */
const defaultConvert: ImageConverter = async (blob, mime, quality) => {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((out) => resolve(out), mime, quality)
    );
  } finally {
    bitmap.close();
  }
};

/** Decode just enough to read dimensions. WebView only. */
const defaultDecode: ImageDecoder = async (blob) => {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
};

/** True when a format can be produced by canvas encoding. */
function isCanvasFormat(format: ImageFormat): format is CanvasFormat {
  return CANVAS_FORMATS.includes(format);
}

/**
 * Converts an image blob to `target` (JPEG/PNG/WebP). Throws
 * {@link ImageEngineError} with `UNSUPPORTED_FORMAT` for non-canvas
 * targets and `CONVERSION_FAILED` when the encoder yields nothing.
 */
export async function convertFormat(
  blob: Blob,
  target: ImageFormat,
  deps: ImageEngineDeps = {},
  quality: number = DEFAULT_QUALITY
): Promise<Blob> {
  if (!isCanvasFormat(target)) {
    throw new ImageEngineError(
      'UNSUPPORTED_FORMAT',
      'convertFormat',
      `Cannot encode to ${target}; supported targets are JPEG, PNG, WebP.`
    );
  }
  const convert = deps.convert ?? defaultConvert;
  let out: Blob | null;
  try {
    out = await convert(blob, FORMAT_MIME[target], quality);
  } catch (cause) {
    throw new ImageEngineError(
      'CONVERSION_FAILED',
      'convertFormat',
      `Failed to convert image to ${target}: ${String(cause)}`
    );
  }
  if (!out) {
    throw new ImageEngineError(
      'CONVERSION_FAILED',
      'convertFormat',
      `Encoder produced no output for ${target}.`
    );
  }
  return out;
}

/** Reads format (magic bytes), dimensions, size, and MIME for a blob. */
export async function getImageInfo(
  blob: Blob,
  deps: ImageEngineDeps = {}
): Promise<ImageInfo> {
  const decode = deps.decode ?? defaultDecode;
  const format = await detectFormat(blob);
  const { width, height } = await decode(blob);
  return {
    width,
    height,
    format,
    fileSize: blob.size,
    mimeType: format ? FORMAT_MIME[format] : blob.type,
  };
}
