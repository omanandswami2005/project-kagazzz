import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { useDatabase, findArchived, update, softDelete } = vi.hoisted(() => ({
  useDatabase: vi.fn(),
  findArchived: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase }));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    findArchived = findArchived;
    update = update;
    softDelete = softDelete;
  },
}));

import { useArchive } from '../useArchive';
import { useVaultStore } from '../../store/vault.store';

const doc = (id: string): DocumentEntity => ({ id, name: id, isArchived: true }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  useDatabase.mockReturnValue({ db: {}, status: 'ready' });
  findArchived.mockResolvedValue([doc('a'), doc('b')]);
  update.mockResolvedValue(1);
  softDelete.mockResolvedValue(1);
  useVaultStore.setState({ documents: [], folderPath: [] });
});

describe('useArchive (F-89)', () => {
  it('loads archived documents on mount', async () => {
    const { result } = renderHook(() => useArchive());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('unarchive persists isArchived: false and drops the row from the list', async () => {
    const { result } = renderHook(() => useArchive());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.unarchive(doc('a'));
    });
    expect(update).toHaveBeenCalledWith('a', { isArchived: false });
    expect(result.current.items.map((d) => d.id)).toEqual(['b']);
  });

  it('unarchive also reflects the document into the shared vault store (bug-audit follow-up: main list staleness)', async () => {
    const { result } = renderHook(() => useArchive());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.unarchive(doc('a'));
    });
    expect(useVaultStore.getState().documents.map((d) => d.id)).toContain('a');
  });

  it('does not leak into the vault store when the document belongs to a different folder', async () => {
    useVaultStore.setState({
      documents: [],
      folderPath: [{ id: 'f1', name: 'F1', sortOrder: 0, createdAt: '', updatedAt: '' }],
    });
    const { result } = renderHook(() => useArchive());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      // doc('a') has no folderId (root) while the vault is viewing folder f1.
      await result.current.unarchive(doc('a'));
    });
    expect(useVaultStore.getState().documents.map((d) => d.id)).not.toContain('a');
  });

  it('rolls back the optimistic removal when unarchive fails', async () => {
    update.mockRejectedValue(new Error('db'));
    const { result } = renderHook(() => useArchive());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.unarchive(doc('a'));
    });
    expect(result.current.items.map((d) => d.id)).toContain('a');
  });

  it('deleteToTrash soft-deletes and drops the row from the list', async () => {
    const { result } = renderHook(() => useArchive());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.deleteToTrash(doc('b'));
    });
    expect(softDelete).toHaveBeenCalledWith('b');
    expect(result.current.items.map((d) => d.id)).toEqual(['a']);
  });
});
