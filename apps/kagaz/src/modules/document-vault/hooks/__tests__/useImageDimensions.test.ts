import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { read, getImageInfo } = vi.hoisted(() => ({
  read: vi.fn(),
  getImageInfo: vi.fn(),
}));

vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read }),
}));
vi.mock('@/modules/image-engine/services/image-engine.service', () => ({
  getImageInfo,
}));

import { useImageDimensions } from '../useImageDimensions';

const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({
    id: 'd1',
    name: 'photo',
    filePath: 'documents/d1.jpg',
    fileType: 'jpg',
    ...over,
  }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(new Uint8Array([1, 2, 3]));
  getImageInfo.mockResolvedValue({
    width: 1024,
    height: 768,
    format: 'jpeg',
    fileSize: 3,
    mimeType: 'image/jpeg',
  });
});

describe('useImageDimensions (F-8 getImageInfo → F-67 Details sheet)', () => {
  it('is null while loading and then resolves the pixel dimensions', async () => {
    const { result } = renderHook(() => useImageDimensions(doc()));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual({ width: 1024, height: 768 }));
    expect(read).toHaveBeenCalledWith('documents/d1.jpg');
    expect(getImageInfo).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('is null for a null document', () => {
    const { result } = renderHook(() => useImageDimensions(null));
    expect(result.current).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('is null for a non-canvas-decodable format (e.g. heic, pdf) — never attempts to read', () => {
    const { result } = renderHook(() => useImageDimensions(doc({ fileType: 'heic' })));
    expect(result.current).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('stays null (no throw) when the read or decode fails', async () => {
    getImageInfo.mockRejectedValue(new Error('decode boom'));
    const { result } = renderHook(() => useImageDimensions(doc()));
    await waitFor(() => expect(read).toHaveBeenCalled());
    // Give the rejected promise a tick to settle without ever setting state.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current).toBeNull();
  });

  it('resets to null and re-fetches when the document changes', async () => {
    const { result, rerender } = renderHook(
      ({ document }) => useImageDimensions(document),
      { initialProps: { document: doc() } }
    );
    await waitFor(() => expect(result.current).toEqual({ width: 1024, height: 768 }));

    getImageInfo.mockResolvedValue({
      width: 200,
      height: 100,
      format: 'png',
      fileSize: 3,
      mimeType: 'image/png',
    });
    rerender({ document: doc({ id: 'd2', filePath: 'documents/d2.png', fileType: 'png' }) });
    await waitFor(() => expect(result.current).toEqual({ width: 200, height: 100 }));
    expect(read).toHaveBeenCalledWith('documents/d2.png');
  });

  it('does not re-fetch on a new object reference for the same logical document (regression)', async () => {
    // A parent passing a fresh `DocumentEntity` object each render (e.g. a
    // new array from a store selector) for the *same* document must not
    // retrigger the effect — depending on object identity here caused an
    // infinite render loop ("Maximum update depth exceeded") during this
    // hook's own test authoring.
    const { result, rerender } = renderHook(
      ({ document }) => useImageDimensions(document),
      { initialProps: { document: doc() } }
    );
    await waitFor(() => expect(result.current).toEqual({ width: 1024, height: 768 }));
    expect(read).toHaveBeenCalledTimes(1);

    rerender({ document: doc() }); // same id/filePath/fileType, new object
    rerender({ document: doc() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(read).toHaveBeenCalledTimes(1);
  });
});
