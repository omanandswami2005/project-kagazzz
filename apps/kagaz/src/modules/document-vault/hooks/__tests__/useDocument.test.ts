import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { useDatabase, findById, findTrashedById } = vi.hoisted(() => ({
  useDatabase: vi.fn(),
  findById: vi.fn(),
  findTrashedById: vi.fn(),
}));

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase }));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    findById = findById;
    findTrashedById = findTrashedById;
  },
}));

import { useDocument } from '../useDocument';

const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({ id: 'd1', name: 'PAN Card', ...over }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  useDatabase.mockReturnValue({ db: {}, status: 'ready' });
  findById.mockResolvedValue(doc());
  findTrashedById.mockResolvedValue(doc({ deletedAt: '2026-07-01T00:00:00.000Z' }));
});

describe('useDocument (UX-6)', () => {
  it('loads a live document via findById by default', async () => {
    const { result } = renderHook(() => useDocument('d1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(findById).toHaveBeenCalledWith('d1');
    expect(findTrashedById).not.toHaveBeenCalled();
    expect(result.current.document).toEqual(doc());
  });

  it('loads a soft-deleted document via findTrashedById when trashed: true (F-57 preview)', async () => {
    const { result } = renderHook(() => useDocument('d1', { trashed: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(findTrashedById).toHaveBeenCalledWith('d1');
    expect(findById).not.toHaveBeenCalled();
    expect(result.current.document?.deletedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('returns null when the trashed document is not found', async () => {
    findTrashedById.mockResolvedValue(null);
    const { result } = renderHook(() => useDocument('missing', { trashed: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.document).toBeNull();
  });
});
