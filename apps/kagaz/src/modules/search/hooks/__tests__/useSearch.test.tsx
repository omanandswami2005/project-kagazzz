import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { docRow } from '@/modules/document-vault/__tests__/fixtures/vault-fixtures';
import { useSearch, SEARCH_DEBOUNCE_MS } from '../useSearch';

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
const useDatabaseMock = vi.mocked(useDatabase);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useSearch (F-11)', () => {
  it('stays idle below the minimum query length', () => {
    useDatabaseMock.mockReturnValue({ status: 'ready', db: new FakeDb() });
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setQuery('a'));
    expect(result.current.isActive).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it('debounces, runs an FTS query, and exposes results', async () => {
    const db = new FakeDb().onQuery(/documents_fts MATCH/, [docRow()]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('aadh'));
    expect(result.current.isSearching).toBe(true);
    // No query before the debounce window elapses.
    expect(db.calls.filter((c) => c.kind === 'query')).toHaveLength(0);

    // advanceTimersByTimeAsync flushes the timer AND the async query.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.results).toHaveLength(1);
    const matchCall = db.calls.find((c) => c.sql.includes('documents_fts MATCH'));
    expect(matchCall?.params?.[0]).toBe('aadh*'); // prefix query built
  });

  it('clears results when the query is emptied', async () => {
    const db = new FakeDb().onQuery(/documents_fts MATCH/, [docRow()]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('aadh'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    expect(result.current.results).toHaveLength(1);

    act(() => result.current.setQuery(''));
    expect(result.current.isActive).toBe(false);
    expect(result.current.results).toEqual([]);
  });
});
