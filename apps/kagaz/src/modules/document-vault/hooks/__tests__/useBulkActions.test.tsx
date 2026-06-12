import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { docRow } from '../../__tests__/fixtures/vault-fixtures';
import { useVaultStore } from '../../store/vault.store';
import { useBulkActions } from '../useBulkActions';

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
const useDatabaseMock = vi.mocked(useDatabase);

function seedSelection(ids: string[]): void {
  useVaultStore.setState({
    selectionMode: true,
    selectedIds: ids,
    documents: ids.map((id) => ({ ...docRow({ id }) }) as never),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useVaultStore.setState({ selectionMode: false, selectedIds: [], documents: [] });
});

describe('useBulkActions (F-25)', () => {
  it('bulkDelete soft-deletes each, drops them, exits selection', async () => {
    const db = new FakeDb();
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    seedSelection(['a', 'b']);
    const { result } = renderHook(() => useBulkActions());

    const count = await result.current.bulkDelete();
    expect(count).toBe(2);
    const deletes = db.calls.filter((c) => c.sql.includes('deleted_at = ?'));
    expect(deletes).toHaveLength(2);
    expect(useVaultStore.getState().documents).toHaveLength(0);
    expect(useVaultStore.getState().selectionMode).toBe(false);
  });

  it('bulkMove updates folder_id for each and drops them', async () => {
    const db = new FakeDb();
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    seedSelection(['a']);
    const { result } = renderHook(() => useBulkActions());

    await result.current.bulkMove('f-1');
    const move = db.calls.find((c) => c.sql.includes('folder_id'));
    expect(move?.params).toContain('f-1');
    expect(useVaultStore.getState().documents).toHaveLength(0);
  });

  it('bulkFavorite patches docs (keeps them in the list)', async () => {
    const db = new FakeDb();
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    seedSelection(['a', 'b']);
    const { result } = renderHook(() => useBulkActions());

    const count = await result.current.bulkFavorite();
    expect(count).toBe(2);
    // Still present, now favorited.
    expect(useVaultStore.getState().documents).toHaveLength(2);
    expect(
      useVaultStore.getState().documents.every((d) => d.isFavorite)
    ).toBe(true);
  });

  it('no-ops with an empty selection', async () => {
    useDatabaseMock.mockReturnValue({ status: 'ready', db: new FakeDb() });
    useVaultStore.setState({ selectedIds: [] });
    const { result } = renderHook(() => useBulkActions());
    await expect(result.current.bulkDelete()).resolves.toBe(0);
  });
});
