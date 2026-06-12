import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { docRow } from '../../__tests__/fixtures/vault-fixtures';
import { useVaultStore } from '../../store/vault.store';
import { useFolders } from '../useFolders';

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
const useDatabaseMock = vi.mocked(useDatabase);

const folderRow = {
  id: 'f-1',
  name: 'Taxes',
  parent_id: null,
  icon: null,
  color: null,
  sort_order: 0,
  created_at: '2026-06-11T00:00:00.000Z',
  updated_at: '2026-06-11T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  useVaultStore.setState({ documents: [], folderPath: [] });
});

describe('useFolders (F-9)', () => {
  it('loads children of the current folder', async () => {
    const db = new FakeDb().onQuery(/FROM folders WHERE parent_id IS NULL/, [
      folderRow,
    ]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(1));
    expect(result.current.folders[0]?.name).toBe('Taxes');
  });

  it('createFolder inserts under the current folder', async () => {
    const db = new FakeDb()
      .onQuery(/parent_id IS NULL/, [])
      .onQuery(/FROM folders WHERE id/, [folderRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.folders).toEqual([]));

    const folder = await result.current.createFolder('Taxes');
    expect(folder?.id).toBe('f-1');
    const insert = db.calls.find(
      (c) => c.kind === 'run' && c.sql.includes('INSERT INTO folders')
    );
    expect(insert).toBeDefined();
  });

  it('moveDocument updates the doc and drops it from the list', async () => {
    const db = new FakeDb()
      .onQuery(/parent_id IS NULL/, [])
      .onQuery(/FROM documents WHERE id/, [docRow({ id: 'doc-1' })]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    useVaultStore.setState({
      documents: [
        { ...docRow({ id: 'doc-1' }) } as never,
      ],
    });
    const { result } = renderHook(() => useFolders());

    await result.current.moveDocument('doc-1', 'f-1');
    const update = db.calls.find(
      (c) => c.kind === 'run' && c.sql.includes('UPDATE documents')
    );
    expect(update?.sql).toContain('folder_id');
    expect(useVaultStore.getState().documents).toHaveLength(0);
  });

  it('no-ops without a database', async () => {
    useDatabaseMock.mockReturnValue({ status: 'error', db: null });
    const { result } = renderHook(() => useFolders());
    await expect(result.current.createFolder('x')).resolves.toBeNull();
    await expect(result.current.moveDocument('d', null)).resolves.toBeUndefined();
  });

  it('createDefaultFolders inserts each starter folder (F-30)', async () => {
    const db = new FakeDb()
      .onQuery(/parent_id IS NULL/, [])
      .onQuery(/FROM folders WHERE id/, [folderRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useFolders());

    const count = await result.current.createDefaultFolders([
      { name: 'Identity', icon: 'Lock', color: '#3b82f6' },
      { name: 'Health', icon: 'Heart', color: '#ef4444' },
    ]);
    expect(count).toBe(2);
    const inserts = db.calls.filter(
      (c) => c.kind === 'run' && c.sql.includes('INSERT INTO folders')
    );
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.params).toContain('Identity');
  });
});
