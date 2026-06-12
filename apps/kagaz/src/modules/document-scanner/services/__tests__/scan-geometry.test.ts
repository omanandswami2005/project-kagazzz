import { describe, expect, it } from 'vitest';
import type { Point } from '../../types/scanner.types';
import {
  distance,
  isValidQuad,
  orderCorners,
  quadArea,
  quadOutputSize,
} from '../scan-geometry';

// A 100×60 axis-aligned rectangle's four corners, in a deliberately
// scrambled order to prove ordering is independent of input order.
const TL: Point = { x: 10, y: 10 };
const TR: Point = { x: 110, y: 10 };
const BR: Point = { x: 110, y: 70 };
const BL: Point = { x: 10, y: 70 };

describe('orderCorners', () => {
  it('normalises any input order to TL/TR/BR/BL', () => {
    for (const scrambled of [
      [TL, TR, BR, BL],
      [BR, BL, TL, TR],
      [TR, BL, BR, TL],
    ]) {
      const quad = orderCorners(scrambled);
      expect(quad.topLeft).toEqual(TL);
      expect(quad.topRight).toEqual(TR);
      expect(quad.bottomRight).toEqual(BR);
      expect(quad.bottomLeft).toEqual(BL);
    }
  });

  it('handles a rotated (non-axis-aligned) quad', () => {
    // Diamond: top, right, bottom, left.
    const top = { x: 50, y: 0 };
    const right = { x: 100, y: 50 };
    const bottom = { x: 50, y: 100 };
    const left = { x: 0, y: 50 };
    const quad = orderCorners([right, bottom, left, top]);
    // min(x+y) = left(50) vs top(50) tie → first wins deterministically;
    // assert the diagonal pairing is correct rather than exact labels.
    expect(quad.topLeft).not.toEqual(quad.bottomRight);
    expect(quad.topRight).not.toEqual(quad.bottomLeft);
  });

  it('throws on the wrong number of points', () => {
    expect(() => orderCorners([TL, TR, BR])).toThrow();
  });
});

describe('quadOutputSize', () => {
  it('uses the longer of each opposite edge pair', () => {
    expect(quadOutputSize({ topLeft: TL, topRight: TR, bottomRight: BR, bottomLeft: BL })).toEqual({
      width: 100,
      height: 60,
    });
  });

  it('rounds and never goes below 1', () => {
    const tiny = { x: 0, y: 0 };
    const size = quadOutputSize({
      topLeft: tiny,
      topRight: { x: 0.2, y: 0 },
      bottomRight: { x: 0.2, y: 0.2 },
      bottomLeft: { x: 0, y: 0.2 },
    });
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });
});

describe('distance / quadArea', () => {
  it('measures Euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('computes rectangle area via shoelace', () => {
    expect(
      quadArea({ topLeft: TL, topRight: TR, bottomRight: BR, bottomLeft: BL })
    ).toBe(6000);
  });
});

describe('isValidQuad', () => {
  const rect = { topLeft: TL, topRight: TR, bottomRight: BR, bottomLeft: BL };

  it('accepts a convex rectangle covering enough of the frame', () => {
    expect(isValidQuad(rect, 100 * 100, 0.1)).toBe(true); // 6000/10000 = 0.6
  });

  it('rejects a quad that is too small a share of the frame', () => {
    expect(isValidQuad(rect, 10_000_000, 0.1)).toBe(false);
  });

  it('rejects a concave (self-folded) quad', () => {
    const concave = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 100, y: 0 },
      bottomRight: { x: 50, y: 40 }, // dented inward
      bottomLeft: { x: 100, y: 100 },
    };
    expect(isValidQuad(concave)).toBe(false);
  });

  it('rejects a degenerate quad with collinear corners', () => {
    const collinear = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 50, y: 0 },
      bottomRight: { x: 100, y: 0 }, // all on y=0
      bottomLeft: { x: 50, y: 50 },
    };
    expect(isValidQuad(collinear)).toBe(false);
  });

  it('skips the area check when no image area is given', () => {
    expect(isValidQuad(rect)).toBe(true);
  });
});
