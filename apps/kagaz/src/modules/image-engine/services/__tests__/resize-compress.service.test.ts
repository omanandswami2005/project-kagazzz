import { describe, expect, it, vi } from 'vitest';
import { ImageEngineError } from '../../types/image.types';
import { resizeAndCompress, type PreparedResize } from '../resize-compress.service';

const sourceBlob = (): Blob => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])]);

/** Deterministic fake: encoded size scales linearly with quality. */
function fakePrepare(bytesAtFullQuality: number) {
  const encode = vi.fn(
    async (_mime: string, quality: number): Promise<Blob | null> =>
      new Blob([new Uint8Array(Math.round(bytesAtFullQuality * quality))])
  );
  const prepare = vi.fn(
    async (): Promise<PreparedResize> => ({ encode })
  );
  return { prepare, encode };
}

describe('resizeAndCompress (F-85)', () => {
  it('resizes to the exact requested dimensions via the injected prepare step', async () => {
    const { prepare } = fakePrepare(50_000);
    const result = await resizeAndCompress(
      sourceBlob(),
      { width: 200, height: 230, maxSizeBytes: 50_000 },
      { prepare }
    );
    expect(prepare).toHaveBeenCalledWith(expect.any(Blob), 200, 230);
    expect(result.width).toBe(200);
    expect(result.height).toBe(230);
  });

  it('finds a quality whose encoded size fits under maxSizeBytes', async () => {
    const { prepare } = fakePrepare(100_000); // quality 1.0 -> 100KB, quality 0.5 -> 50KB
    const result = await resizeAndCompress(
      sourceBlob(),
      { width: 100, height: 100, maxSizeBytes: 50_000 },
      { prepare }
    );
    expect(result.blob.size).toBeLessThanOrEqual(50_000);
    expect(result.hitQualityFloor).toBe(false);
    // Should have converged close to the quality that saturates the budget.
    expect(result.qualityUsed).toBeGreaterThan(0.4);
    expect(result.qualityUsed).toBeLessThan(0.6);
  });

  it('maximizes quality within budget rather than over-compressing', async () => {
    const { prepare } = fakePrepare(20_000); // even quality 1.0 fits comfortably
    const result = await resizeAndCompress(
      sourceBlob(),
      { width: 100, height: 100, maxSizeBytes: 50_000 },
      { prepare }
    );
    expect(result.qualityUsed).toBeGreaterThan(0.9);
  });

  it('flags hitQualityFloor when even the lowest quality exceeds the budget', async () => {
    const { prepare } = fakePrepare(1_000_000); // quality 0.1 -> 100KB, still over a 10KB budget
    const result = await resizeAndCompress(
      sourceBlob(),
      { width: 100, height: 100, maxSizeBytes: 10_000 },
      { prepare }
    );
    expect(result.hitQualityFloor).toBe(true);
    expect(result.qualityUsed).toBe(0.1);
  });

  it('rejects non-positive dimensions or budget with INVALID_IMAGE', async () => {
    await expect(
      resizeAndCompress(sourceBlob(), { width: 0, height: 100, maxSizeBytes: 1000 })
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
    await expect(
      resizeAndCompress(sourceBlob(), { width: 100, height: 100, maxSizeBytes: 0 })
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });

  it('throws CANVAS_ERROR when the encoder yields nothing', async () => {
    const prepare = vi.fn(async (): Promise<PreparedResize> => ({
      encode: vi.fn().mockResolvedValue(null),
    }));
    await expect(
      resizeAndCompress(
        sourceBlob(),
        { width: 100, height: 100, maxSizeBytes: 50_000 },
        { prepare }
      )
    ).rejects.toBeInstanceOf(ImageEngineError);
  });

  it('re-encodes the same prepared canvas across iterations instead of re-preparing', async () => {
    const { prepare } = fakePrepare(100_000);
    await resizeAndCompress(
      sourceBlob(),
      { width: 100, height: 100, maxSizeBytes: 50_000 },
      { prepare }
    );
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
