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
import { useVaultStore } from '../../store/vault.store';

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
  useVaultStore.setState({ documents: [], folderPath: [] });
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

  it('restore also reflects the document into the shared vault store (bug-audit fix: main list staleness)', async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.restore(doc('a'));
    });
    expect(useVaultStore.getState().documents.map((d) => d.id)).toContain('a');
  });

  it('does not leak into the vault store when the restored document belongs to a different folder', async () => {
    useVaultStore.setState({
      documents: [],
      folderPath: [{ id: 'f1', name: 'F1', sortOrder: 0, createdAt: '', updatedAt: '' }],
    });
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.restore(doc('a'));
    });
    expect(useVaultStore.getState().documents).toEqual([]);
  });

  it('rolls back the local list and logs when the DAO restore fails', async () => {
    restore.mockRejectedValue(new Error('db exploded'));
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.restore(doc('a'));
    });
    expect(result.current.items.map((d) => d.id).sort()).toEqual(['a', 'b']);
    expect(useVaultStore.getState().documents).toEqual([]);
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
