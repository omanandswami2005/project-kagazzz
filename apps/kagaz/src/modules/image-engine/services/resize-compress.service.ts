/**
 * Resize & Compress for Forms (F-85, 04-image-engine-module.md §9.3).
 * Resizes to *exact* target pixel dimensions (stretch, not "fit within a
 * box" — most Indian government-form photo/signature specs want an exact
 * non-proportional size) and binary-searches JPEG quality until the result
 * fits a target byte budget. Pure Canvas, zero new dependency, same
 * inject-the-canvas-ops-for-testability pattern as `image-engine.service.ts`.
 */
import { ImageEngineError } from '../types/image.types';

/** A canvas already decoded + resized to the exact target dimensions. */
export interface PreparedResize {
  /** Re-encodes the already-resized canvas at `quality` (0–1); cheap — no redraw. */
  encode: (mime: string, quality: number) => Promise<Blob | null>;
}

/** Injectable resize step (tests pass a fake; runtime uses Canvas). */
export interface ResizeCompressDeps {
  prepare?: (blob: Blob, width: number, height: number) => Promise<PreparedResize>;
}

/** Target shape for {@link resizeAndCompress}. */
export interface ResizeCompressTarget {
  /** Exact output width in pixels. */
  width: number;
  /** Exact output height in pixels. */
  height: number;
  /** Hard ceiling — the search never returns a larger result on purpose. */
  maxSizeBytes: number;
  /** Optional floor; purely informational (see {@link ResizeCompressResult}). */
  minSizeBytes?: number;
}

/** Result of a resize+compress run. */
export interface ResizeCompressResult {
  blob: Blob;
  width: number;
  height: number;
  /** JPEG quality (0–1) the final blob was encoded at. */
  qualityUsed: number;
  /**
   * True when even the lowest quality tried still exceeds `maxSizeBytes` —
   * the caller should warn the user (try smaller dimensions) rather than
   * silently hand back an over-budget file.
   */
  hitQualityFloor: boolean;
}

const MIN_QUALITY = 0.1;
const MAX_ITERATIONS = 8;

/** Decode → draw onto a `width`×`height` canvas (stretch) → re-encodable handle. */
const defaultPrepare: NonNullable<ResizeCompressDeps['prepare']> = async (
  blob,
  width,
  height
) => {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageEngineError(
        'CANVAS_ERROR',
        'resizeAndCompress',
        '2D canvas context unavailable.'
      );
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
  } finally {
    bitmap.close();
  }
  return {
    encode: (mime, quality) =>
      new Promise<Blob | null>((resolve) =>
        canvas.toBlob((out) => resolve(out), mime, quality)
      ),
  };
};

/**
 * Resizes `blob` to exact `target.width`×`target.height` and binary-searches
 * JPEG quality for the highest quality whose encoded size is still
 * `<= target.maxSizeBytes`. Throws {@link ImageEngineError} `INVALID_IMAGE`
 * for non-positive dimensions/budget, `CANVAS_ERROR` if the encoder ever
 * yields nothing.
 */
export async function resizeAndCompress(
  blob: Blob,
  target: ResizeCompressTarget,
  deps: ResizeCompressDeps = {}
): Promise<ResizeCompressResult> {
  if (target.width <= 0 || target.height <= 0 || target.maxSizeBytes <= 0) {
    throw new ImageEngineError(
      'INVALID_IMAGE',
      'resizeAndCompress',
      'width, height, and maxSizeBytes must all be positive.'
    );
  }

  const prepare = deps.prepare ?? defaultPrepare;
  const prepared = await prepare(blob, target.width, target.height);

  const encodeAt = async (quality: number): Promise<Blob> => {
    const out = await prepared.encode('image/jpeg', quality);
    if (!out) {
      throw new ImageEngineError(
        'CANVAS_ERROR',
        'resizeAndCompress',
        'Encoder produced no output.'
      );
    }
    return out;
  };

  let low = MIN_QUALITY;
  let high = 1;
  let best: { blob: Blob; quality: number } | null = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const quality = (low + high) / 2;
    const out = await encodeAt(quality);
    if (out.size <= target.maxSizeBytes) {
      best = { blob: out, quality };
      low = quality;
    } else {
      high = quality;
    }
  }

  if (best) {
    return {
      blob: best.blob,
      width: target.width,
      height: target.height,
      qualityUsed: best.quality,
      hitQualityFloor: false,
    };
  }

  const floor = await encodeAt(MIN_QUALITY);
  return {
    blob: floor,
    width: target.width,
    height: target.height,
    qualityUsed: MIN_QUALITY,
    hitQualityFloor: true,
  };
}
