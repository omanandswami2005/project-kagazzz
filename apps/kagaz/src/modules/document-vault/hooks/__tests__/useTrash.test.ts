import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { useDatabase, restore, purgeExpiredTrash, deleteForever, emptyTrash, listTrashed } =
  vi.hoisted(() => ({
    useDatabase: vi.fn(),
    restore: vi.fn(),
    purgeExpiredTrash: vi.fn(),
    deleteForever: vi.fn(),
    emptyTrash: vi.fn(),
    listTrashed: vi.fn(),
  }));

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase }));
vi.mock('@/infrastructure/filesystem', () => ({ createFileStorage: () => ({}) }));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    restore = restore;
  },
}));
vi.mock('../../services/trash.service', () => ({
  createTrashDeps: () => ({ listTrashed }),
  purgeExpiredTrash,
  deleteForever,
  emptyTrash,
}));

import { useTrash } from '../useTrash';

const doc = (id: string): DocumentEntity =>
  ({ id, name: id, deletedAt: '2026-07-01T00:00:00.000Z' }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  useDatabase.mockReturnValue({ db: {}, status: 'ready' });
  purgeExpiredTrash.mockResolvedValue({ purged: 0 });
  listTrashed.mockResolvedValue([doc('a'), doc('b')]);
  restore.mockResolvedValue(1);
  deleteForever.mockResolvedValue(true);
  emptyTrash.mockResolvedValue({ purged: 2 });
});

describe('useTrash (F-57)', () => {
  it('purges expired items then loads the trash on mount', async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(purgeExpiredTrash).toHaveBeenCalledOnce();
    expect(result.current.items.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('restore removes the row and drops it from the list', async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.restore(doc('a'));
    });
    expect(restore).toHaveBeenCalledWith('a');
    expect(result.current.items.map((d) => d.id)).toEqual(['b']);
  });

  it('deleteForever purges one document and drops it from the list', async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.deleteForever(doc('b'));
    });
    expect(deleteForever).toHaveBeenCalledOnce();
    expect(result.current.items.map((d) => d.id)).toEqual(['a']);
  });

  it('emptyTrash clears the whole list', async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.emptyTrash();
    });
    expect(emptyTrash).toHaveBeenCalledOnce();
    expect(result.current.items).toEqual([]);
  });
});
