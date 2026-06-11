import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { docRow, entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { useVaultStore } from '../../store/vault.store';
import { useVaultMutations } from '../useVaultMutations';

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
const useDatabaseMock = vi.mocked(useDatabase);

const fav = entityFromNew(
  {
    name: 'doc',
    filePath: 'documents/doc-1.pdf',
    fileType: 'pdf',
    fileSize: 1,
    isFavorite: false,
    isLocked: false,
    isArchived: false,
    language: 'en',
    sourceType: 'file_picker',
  },
  'doc-1'
);

beforeEach(() => {
  useVaultStore.setState({ documents: [fav], sortBy: 'createdAt', sortDirection: 'desc' });
});

describe('useVaultMutations.toggleFavorite (F-33)', () => {
  it('persists the new flag and patches the store optimistically', async () => {
    const db = new FakeDb().onQuery(/WHERE id = \?/, [docRow({ is_favorite: 1 })]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useVaultMutations());

    await result.current.toggleFavorite(fav);

    expect(
      useVaultStore.getState().documents[0]?.isFavorite
    ).toBe(true);
    // The UPDATE ran against the DAO with is_favorite = 1.
    const runCall = db.calls.find((c) => c.kind === 'run');
    expect(runCall?.sql).toContain('is_favorite');
  });

  it('rolls the store back when the DB write fails', async () => {
    const db = new FakeDb();
    db.run = vi.fn(() => Promise.reject(new Error('SQLITE_BUSY')));
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useVaultMutations());

    await result.current.toggleFavorite(fav);

    expect(useVaultStore.getState().documents[0]?.isFavorite).toBe(false);
  });

  it('no-ops without a database', async () => {
    useDatabaseMock.mockReturnValue({ status: 'error', db: null });
    const { result } = renderHook(() => useVaultMutations());
    await expect(result.current.toggleFavorite(fav)).resolves.toBeUndefined();
  });
});

describe('useVaultMutations.markAccessed (F-32)', () => {
  it('stamps last_accessed_at via the DAO', async () => {
    const db = new FakeDb();
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useVaultMutations());

    await result.current.markAccessed(fav);

    const runCall = db.calls.find((c) => c.kind === 'run');
    expect(runCall?.sql).toContain('last_accessed_at');
  });

  it('swallows DAO failures', async () => {
    const db = new FakeDb();
    db.run = vi.fn(() => Promise.reject(new Error('disk full')));
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useVaultMutations());
    await expect(result.current.markAccessed(fav)).resolves.toBeUndefined();
  });
});
