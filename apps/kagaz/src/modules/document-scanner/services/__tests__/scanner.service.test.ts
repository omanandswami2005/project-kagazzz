import { describe, expect, it, vi } from 'vitest';
import type { Point, Quad } from '../../types/scanner.types';
import {
  applyCorners,
  scanDocument,
  type ScannerEngine,
} from '../scanner.service';

const RECT: Point[] = [
  { x: 10, y: 10 },
  { x: 110, y: 10 },
  { x: 110, y: 70 },
  { x: 10, y: 70 },
];

function fakeEngine(
  corners: Point[] | null,
  imageArea = 100 * 100
): ScannerEngine & { warp: ReturnType<typeof vi.fn> } {
  const warp = vi.fn(
    (_quad: Quad, width: number, height: number): Promise<Blob> =>
      Promise.resolve(new Blob([`${width}x${height}`], { type: 'image/jpeg' }))
  );
  return {
    imageArea,
    detectCorners: () => Promise.resolve(corners),
    warp,
  };
}

describe('scanDocument', () => {
  it('detects, validates, and de-skews a document', async () => {
    const engine = fakeEngine(RECT);
    const result = await scanDocument(engine);
    expect(result).not.toBeNull();
    expect(result?.width).toBe(100);
    expect(result?.height).toBe(60);
    expect(result?.corners.topLeft).toEqual({ x: 10, y: 10 });
    expect(engine.warp).toHaveBeenCalledWith(
      expect.any(Object),
      100,
      60,
      0.92
    );
  });

  it('returns null when no corners are detected', async () => {
    expect(await scanDocument(fakeEngine(null))).toBeNull();
  });

  it('returns null when fewer than four corners are found', async () => {
    expect(await scanDocument(fakeEngine(RECT.slice(0, 3)))).toBeNull();
  });

  it('returns null when the document covers too little of the frame', async () => {
    const engine = fakeEngine(RECT, 10_000_000);
    expect(await scanDocument(engine)).toBeNull();
    expect(engine.warp).not.toHaveBeenCalled();
  });

  it('passes a custom JPEG quality through to the warp', async () => {
    const engine = fakeEngine(RECT);
    await scanDocument(engine, { quality: 0.6 });
    expect(engine.warp).toHaveBeenCalledWith(expect.any(Object), 100, 60, 0.6);
  });
});

describe('applyCorners', () => {
  it('normalises and warps user-adjusted corners', async () => {
    const engine = fakeEngine(null); // detection unused here
    const scrambled = [RECT[2], RECT[0], RECT[3], RECT[1]];
    const result = await applyCorners(engine, scrambled);
    expect(result.corners.topLeft).toEqual({ x: 10, y: 10 });
    expect(result.width).toBe(100);
    expect(engine.warp).toHaveBeenCalledOnce();
  });
});
