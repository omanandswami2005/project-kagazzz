/**
 * Image filters / enhancement (F-29, 04-image-engine-module.md). Pure pixel
 * transforms over an RGBA `Uint8ClampedArray` — no canvas, no DOM — so they are
 * fully unit-testable; the canvas glue (decode → getImageData → filter →
 * putImageData → encode) lives in `applyImageFilter` (image-engine.service).
 *
 * Runs 100% on-device (no network, no WASM). Grayscale/B&W/auto-enhance are the
 * document-scan cleanups; brightness/contrast/invert are general adjustments.
 */

/** An in-place RGBA pixel transform (the `Uint8ClampedArray` clamps to 0–255). */
export type PixelFilter = (data: Uint8ClampedArray) => void;

/** Rec. 601 luma for a pixel at offset `i`. */
function luma(data: Uint8ClampedArray, i: number): number {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/** Desaturates to grayscale (perceptual luma). */
export const grayscale: PixelFilter = (data) => {
  for (let i = 0; i < data.length; i += 4) {
    const l = luma(data, i);
    data[i] = l;
    data[i + 1] = l;
    data[i + 2] = l;
  }
};

/** Inverts colours (photographic negative). */
export const invert: PixelFilter = (data) => {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
};

/** Binarizes to pure black/white at `threshold` (0–255) — crisp scans. */
export function blackAndWhite(threshold = 128): PixelFilter {
  return (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const v = luma(data, i) >= threshold ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  };
}

/** Shifts brightness by `amount` (-255…255). */
export function brightness(amount: number): PixelFilter {
  return (data) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] += amount;
      data[i + 1] += amount;
      data[i + 2] += amount;
    }
  };
}

/** Adjusts contrast by `amount` (-255…255) about mid-grey (128). */
export function contrast(amount: number): PixelFilter {
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  return (data) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] - 128) + 128;
      data[i + 1] = factor * (data[i + 1] - 128) + 128;
      data[i + 2] = factor * (data[i + 2] - 128) + 128;
    }
  };
}

/**
 * Auto-enhance: linear levels stretch — maps the darkest luma to 0 and the
 * brightest to 255, lifting washed-out document photos. A no-op on a flat image
 * (min === max) to avoid divide-by-zero.
 */
export const autoEnhance: PixelFilter = (data) => {
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = luma(data, i);
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const range = max - min;
  if (range <= 0) {
    return;
  }
  const scale = 255 / range;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] - min) * scale;
    data[i + 1] = (data[i + 1] - min) * scale;
    data[i + 2] = (data[i + 2] - min) * scale;
  }
};

/** The parameterless filters offered in the UI, by id. */
export const FILTER_PRESETS = {
  grayscale,
  bw: blackAndWhite(),
  enhance: autoEnhance,
  invert,
} as const satisfies Record<string, PixelFilter>;

/** A selectable preset id (`grayscale` | `bw` | `enhance` | `invert`). */
export type FilterPreset = keyof typeof FILTER_PRESETS;
