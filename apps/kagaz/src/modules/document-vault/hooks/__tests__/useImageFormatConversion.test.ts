import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { ingestFiles, read, convertFormat } = vi.hoisted(() => ({
  ingestFiles: vi.fn(),
  read: vi.fn(),
  convertFormat: vi.fn(),
}));

vi.mock('@/modules/document-vault/hooks/useUpload', () => ({
  useUpload: () => ({ ingestFiles, isReady: true, uploadFrom: vi.fn() }),
}));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read }),
}));
vi.mock('@/modules/image-engine/services/image-engine.service', () => ({
  convertFormat,
}));

import {
  canConvertImageFormat,
  conversionTargetsFor,
  useImageFormatConversion,
} from '../useImageFormatConversion';

// `fileType` is the stored lowercased EXTENSION (e.g. 'jpg'), not a MIME type,
// and `name` — the DB-stored value — never carries an extension (the upload
// pipeline strips it via `splitFileName` at save time); a fixture with an
// extension baked into `name` would hide bugs the real app can hit.
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
  convertFormat.mockResolvedValue(new Blob([new Uint8Array([9])], { type: 'image/png' }));
  ingestFiles.mockResolvedValue({ uploaded: 1, documents: [doc()] });
});

describe('canConvertImageFormat', () => {
  it('is true for canvas-decodable image types', () => {
    for (const fileType of ['jpg', 'jpeg', 'png', 'webp', 'PNG']) {
      expect(canConvertImageFormat(doc({ fileType }))).toBe(true);
    }
  });
  it('is false for non-canvas formats (heic, pdf, etc.)', () => {
    for (const fileType of ['heic', 'pdf', 'bmp', 'tiff', 'gif']) {
      expect(canConvertImageFormat(doc({ fileType }))).toBe(false);
    }
  });
});

describe('conversionTargetsFor', () => {
  it('offers png + webp for a jpg source (excludes its own format)', () => {
    expect(conversionTargetsFor(doc({ fileType: 'jpg' }))).toEqual(['png', 'webp']);
  });
  it('treats jpeg the same as jpg', () => {
    expect(conversionTargetsFor(doc({ fileType: 'jpeg' }))).toEqual(['png', 'webp']);
  });
  it('offers jpeg + webp for a png source', () => {
    expect(conversionTargetsFor(doc({ fileType: 'png' }))).toEqual(['jpeg', 'webp']);
  });
  it('offers jpeg + png for a webp source', () => {
    expect(conversionTargetsFor(doc({ fileType: 'webp' }))).toEqual(['jpeg', 'png']);
  });
});

describe('useImageFormatConversion (F-8)', () => {
  it('converts and saves the result as a new document with the target extension', async () => {
    const { result } = renderHook(() => useImageFormatConversion());
    let ok = false;
    await act(async () => {
      ok = await result.current.convert(doc(), 'png');
    });
    expect(ok).toBe(true);
    expect(read).toHaveBeenCalledWith('documents/d1.jpg');
    expect(convertFormat).toHaveBeenCalledWith(expect.any(Blob), 'png');
    expect(ingestFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'photo.png', source: 'ai_generated' }),
    ]);
  });

  it('appends the target extension to the extension-less stored name', async () => {
    const { result } = renderHook(() => useImageFormatConversion());
    await act(async () => {
      await result.current.convert(doc({ name: 'scan' }), 'webp');
    });
    expect(ingestFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'scan.webp' }),
    ]);
  });

  it('sets runningId while converting, clears it when done', async () => {
    const { result } = renderHook(() => useImageFormatConversion());
    expect(result.current.runningId).toBeNull();
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.convert(doc(), 'png');
    });
    expect(result.current.runningId).toBe('d1');
    await act(async () => {
      await pending;
    });
    expect(result.current.runningId).toBeNull();
  });

  it('returns false (no throw) when conversion fails', async () => {
    convertFormat.mockRejectedValue(new Error('canvas boom'));
    const { result } = renderHook(() => useImageFormatConversion());
    let ok = true;
    await act(async () => {
      ok = await result.current.convert(doc(), 'png');
    });
    expect(ok).toBe(false);
    expect(ingestFiles).not.toHaveBeenCalled();
  });

  it('returns false when the save reports zero uploaded', async () => {
    ingestFiles.mockResolvedValue({ uploaded: 0, documents: [] });
    const { result } = renderHook(() => useImageFormatConversion());
    let ok = true;
    await act(async () => {
      ok = await result.current.convert(doc(), 'png');
    });
    expect(ok).toBe(false);
  });
});
