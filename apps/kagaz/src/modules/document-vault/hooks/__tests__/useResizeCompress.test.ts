import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { ingestFiles, read, resizeAndCompress } = vi.hoisted(() => ({
  ingestFiles: vi.fn(),
  read: vi.fn(),
  resizeAndCompress: vi.fn(),
}));

vi.mock('@/modules/document-vault/hooks/useUpload', () => ({
  useUpload: () => ({ ingestFiles, isReady: true, uploadFrom: vi.fn() }),
}));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read }),
}));
vi.mock('@/modules/image-engine/services/resize-compress.service', () => ({
  resizeAndCompress,
}));

import { useResizeCompress } from '../useResizeCompress';

const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({
    id: 'd1',
    name: 'photo',
    filePath: 'documents/d1.jpg',
    fileType: 'jpg',
    ...over,
  }) as DocumentEntity;

const request = { width: 200, height: 230, maxSizeBytes: 50_000 };

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(new Uint8Array([1, 2, 3]));
  resizeAndCompress.mockResolvedValue({
    blob: new Blob([new Uint8Array(30_000)], { type: 'image/jpeg' }),
    width: 200,
    height: 230,
    qualityUsed: 0.8,
    hitQualityFloor: false,
  });
  ingestFiles.mockResolvedValue({ uploaded: 1, documents: [doc()] });
});

describe('useResizeCompress (F-85)', () => {
  it('resizes+compresses and saves the result with a _resized suffix', async () => {
    const { result } = renderHook(() => useResizeCompress());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(doc(), request);
    });
    expect(outcome?.saved).toBe(true);
    expect(read).toHaveBeenCalledWith('documents/d1.jpg');
    expect(resizeAndCompress).toHaveBeenCalledWith(expect.any(Blob), {
      width: 200,
      height: 230,
      maxSizeBytes: 50_000,
      minSizeBytes: undefined,
    });
    expect(ingestFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'photo_resized.jpg', source: 'ai_generated' }),
    ]);
  });

  it('surfaces hitQualityFloor from the engine result', async () => {
    resizeAndCompress.mockResolvedValue({
      blob: new Blob([new Uint8Array(80_000)]),
      width: 200,
      height: 230,
      qualityUsed: 0.1,
      hitQualityFloor: true,
    });
    const { result } = renderHook(() => useResizeCompress());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(doc(), request);
    });
    expect(outcome?.hitQualityFloor).toBe(true);
  });

  it('flags belowMinSize when the result undershoots a requested minimum', async () => {
    resizeAndCompress.mockResolvedValue({
      blob: new Blob([new Uint8Array(5_000)]),
      width: 200,
      height: 230,
      qualityUsed: 1,
      hitQualityFloor: false,
    });
    const { result } = renderHook(() => useResizeCompress());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(doc(), { ...request, minSizeBytes: 20_000 });
    });
    expect(outcome?.belowMinSize).toBe(true);
  });

  it('sets runningId while running, clears it when done', async () => {
    const { result } = renderHook(() => useResizeCompress());
    expect(result.current.runningId).toBeNull();
    let pending: ReturnType<typeof result.current.run> | undefined;
    act(() => {
      pending = result.current.run(doc(), request);
    });
    expect(result.current.runningId).toBe('d1');
    await act(async () => {
      await pending;
    });
    expect(result.current.runningId).toBeNull();
  });

  it('returns saved:false (no throw) when the engine throws', async () => {
    resizeAndCompress.mockRejectedValue(new Error('canvas boom'));
    const { result } = renderHook(() => useResizeCompress());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(doc(), request);
    });
    expect(outcome?.saved).toBe(false);
    expect(ingestFiles).not.toHaveBeenCalled();
  });

  it('returns saved:false when the save reports zero uploaded', async () => {
    ingestFiles.mockResolvedValue({ uploaded: 0, documents: [] });
    const { result } = renderHook(() => useResizeCompress());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(doc(), request);
    });
    expect(outcome?.saved).toBe(false);
  });
});
