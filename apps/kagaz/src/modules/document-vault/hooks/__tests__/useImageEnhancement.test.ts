import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { ingestFiles, read, applyImageFilter } = vi.hoisted(() => ({
  ingestFiles: vi.fn(),
  read: vi.fn(),
  applyImageFilter: vi.fn(),
}));

vi.mock('@/modules/document-vault/hooks/useUpload', () => ({
  useUpload: () => ({ ingestFiles, isReady: true, uploadFrom: vi.fn() }),
}));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read }),
}));
vi.mock('@/modules/image-engine/services/image-engine.service', () => ({
  applyImageFilter,
}));

import { canApplyImageFilter, useImageEnhancement } from '../useImageEnhancement';

// `fileType` is the stored lowercased EXTENSION (e.g. 'jpg'), not a MIME type,
// and `name` — the DB-stored value — never carries an extension (the upload
// pipeline strips it via `splitFileName` at save time). A fixture with an
// extension baked into `name` masked the real bug this hook shipped with:
// see "does not produce an extension-less filename" below.
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
  applyImageFilter.mockResolvedValue(new Blob([new Uint8Array([9])], { type: 'image/jpeg' }));
  ingestFiles.mockResolvedValue({ uploaded: 1, documents: [doc()] });
});

describe('canApplyImageFilter', () => {
  it('is true for canvas-decodable image types (same gate as F-8)', () => {
    for (const fileType of ['jpg', 'jpeg', 'png', 'webp']) {
      expect(canApplyImageFilter(doc({ fileType }))).toBe(true);
    }
  });
  it('is false for non-canvas formats', () => {
    for (const fileType of ['heic', 'pdf', 'bmp']) {
      expect(canApplyImageFilter(doc({ fileType }))).toBe(false);
    }
  });
});

describe('useImageEnhancement (F-29)', () => {
  it('applies the preset and saves the result with a suffixed name', async () => {
    const { result } = renderHook(() => useImageEnhancement());
    let ok = false;
    await act(async () => {
      ok = await result.current.applyFilter(doc(), 'grayscale');
    });
    expect(ok).toBe(true);
    expect(read).toHaveBeenCalledWith('documents/d1.jpg');
    expect(applyImageFilter).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.any(Function),
      { mime: 'image/jpeg' }
    );
    expect(ingestFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'photo_grayscale.jpg', source: 'ai_generated' }),
    ]);
  });

  it('derives the extension from fileType for a png source', async () => {
    const { result } = renderHook(() => useImageEnhancement());
    await act(async () => {
      await result.current.applyFilter(doc({ name: 'scan', fileType: 'png' }), 'bw');
    });
    expect(ingestFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'scan_bw.png' }),
    ]);
  });

  it('does not produce an extension-less filename (regression: INVALID_FILE_TYPE)', async () => {
    // `document.name` never carries an extension in real data — a save name
    // built from it without appending one fails upload validation outright.
    const { result } = renderHook(() => useImageEnhancement());
    await act(async () => {
      await result.current.applyFilter(doc({ name: 'photo', fileType: 'webp' }), 'invert');
    });
    expect(ingestFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: expect.stringMatching(/\.\w+$/) as string }),
    ]);
    expect(ingestFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'photo_invert.webp' }),
    ]);
  });

  it('tracks runningId while filtering', async () => {
    const { result } = renderHook(() => useImageEnhancement());
    expect(result.current.runningId).toBeNull();
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.applyFilter(doc(), 'enhance');
    });
    expect(result.current.runningId).toBe('d1');
    await act(async () => {
      await pending;
    });
    expect(result.current.runningId).toBeNull();
  });

  it('returns false (no throw) when the filter fails', async () => {
    applyImageFilter.mockRejectedValue(new Error('canvas boom'));
    const { result } = renderHook(() => useImageEnhancement());
    let ok = true;
    await act(async () => {
      ok = await result.current.applyFilter(doc(), 'invert');
    });
    expect(ok).toBe(false);
    expect(ingestFiles).not.toHaveBeenCalled();
  });

  it('returns false when the save reports zero uploaded', async () => {
    ingestFiles.mockResolvedValue({ uploaded: 0, documents: [] });
    const { result } = renderHook(() => useImageEnhancement());
    let ok = true;
    await act(async () => {
      ok = await result.current.applyFilter(doc(), 'grayscale');
    });
    expect(ok).toBe(false);
  });
});
