import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { docRow } from '../../__tests__/fixtures/vault-fixtures';
import { useFavorites } from '../useFavorites';

vi.mock('@/app/providers/DatabaseProvider', () => ({
  useDatabase: vi.fn(),
}));

const useDatabaseMock = vi.mocked(useDatabase);

describe('useFavorites', () => {
  it('loads starred documents once the db is ready', async () => {
    const db = new FakeDb().onQuery(/is_favorite = 1/, [
      docRow({ id: 'fav-1', name: 'Aadhaar', is_favorite: 1 }),
    ]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.favorites).toHaveLength(1));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.favorites[0]?.name).toBe('Aadhaar');
  });

  it('stays empty without a database connection', () => {
    useDatabaseMock.mockReturnValue({ status: 'opening', db: null });
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it('clears loading and stays empty when the query fails', async () => {
    const db = new FakeDb();
    db.query = vi.fn(() => Promise.reject(new Error('SQLITE_CORRUPT')));
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.favorites).toEqual([]);
  });
});
