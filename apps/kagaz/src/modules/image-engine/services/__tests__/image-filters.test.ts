import { describe, expect, it } from 'vitest';
import {
  FILTER_PRESETS,
  autoEnhance,
  blackAndWhite,
  brightness,
  contrast,
  grayscale,
  invert,
} from '../image-filters';

/** Build an RGBA array from [r,g,b] triples (alpha fixed at 255). */
const rgba = (...px: [number, number, number][]): Uint8ClampedArray =>
  new Uint8ClampedArray(px.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('grayscale', () => {
  it('replaces each channel with Rec.601 luma', () => {
    const d = rgba([255, 0, 0]); // luma = 0.299*255 = 76.245 → 76
    grayscale(d);
    expect([d[0], d[1], d[2]]).toEqual([76, 76, 76]);
    expect(d[3]).toBe(255); // alpha untouched
  });
});

describe('invert', () => {
  it('flips each colour channel, keeps alpha', () => {
    const d = rgba([10, 20, 30]);
    invert(d);
    expect([...d]).toEqual([245, 235, 225, 255]);
  });
});

describe('blackAndWhite', () => {
  it('binarizes around the threshold', () => {
    const d = rgba([200, 200, 200], [10, 10, 10]);
    blackAndWhite(128)(d);
    expect([d[0], d[4]]).toEqual([255, 0]);
  });
});

describe('brightness', () => {
  it('shifts and clamps', () => {
    const d = rgba([100, 100, 100], [250, 250, 250]);
    brightness(50)(d);
    expect(d[0]).toBe(150);
    expect(d[4]).toBe(255); // 250+50 clamped
  });
});

describe('contrast', () => {
  it('is a no-op at amount 0 (factor 1)', () => {
    const d = rgba([50, 128, 200]);
    contrast(0)(d);
    expect([d[0], d[1], d[2]]).toEqual([50, 128, 200]);
  });
  it('pushes values away from mid-grey when positive', () => {
    const d = rgba([100, 128, 160]);
    contrast(100)(d);
    expect(d[0]).toBeLessThan(100); // below mid → darker
    expect(d[1]).toBe(128); // mid-grey stays
    expect(d[2]).toBeGreaterThan(160); // above mid → lighter
  });
});

describe('autoEnhance', () => {
  it('stretches the luma range to full 0–255', () => {
    const d = rgba([64, 64, 64], [192, 192, 192]); // min 64, max 192
    autoEnhance(d);
    expect(d[0]).toBe(0); // darkest → 0
    expect(d[4]).toBe(255); // brightest → 255
  });
  it('is a no-op on a flat image (no divide-by-zero)', () => {
    const d = rgba([100, 100, 100], [100, 100, 100]);
    autoEnhance(d);
    expect([...d]).toEqual([100, 100, 100, 255, 100, 100, 100, 255]);
  });
});

describe('FILTER_PRESETS', () => {
  it('exposes the four parameterless presets', () => {
    expect(Object.keys(FILTER_PRESETS).sort()).toEqual(['bw', 'enhance', 'grayscale', 'invert']);
    const d = rgba([255, 0, 0]);
    FILTER_PRESETS.grayscale(d);
    expect(d[0]).toBe(76);
  });
});
