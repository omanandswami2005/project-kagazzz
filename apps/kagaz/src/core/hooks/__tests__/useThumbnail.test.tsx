import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThumbnail } from '../useThumbnail';

const read = vi.fn();
vi.mock('@/infrastructure/filesystem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/filesystem')>()),
  createFileStorage: () => ({ read }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:thumb-1'),
    revokeObjectURL: vi.fn(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useThumbnail (F-24)', () => {
  it('returns null when there is no path (no read)', () => {
    const { result } = renderHook(() => useThumbnail(undefined));
    expect(result.current).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('reads the file and exposes an object URL', async () => {
    read.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const { result } = renderHook(() => useThumbnail('thumbnails/a.jpg'));
    await waitFor(() => expect(result.current).toBe('blob:thumb-1'));
    expect(read).toHaveBeenCalledWith('thumbnails/a.jpg');
  });

  it('stays null when the read fails', async () => {
    read.mockRejectedValue(new Error('missing'));
    const { result } = renderHook(() => useThumbnail('thumbnails/x.jpg'));
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
