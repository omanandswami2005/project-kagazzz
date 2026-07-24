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
    const db = new FakeDb()
      .onQuery(/sqlite_master/, [{ 1: 1 }])
      .onQuery(/documents_fts MATCH/, [docRow()]);
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

  it('drops a stale response when an older query resolves after a newer one (bug-audit follow-up)', async () => {
    // A custom DbConnection whose FTS-availability check resolves instantly
    // but whose actual search query returns a manually-controlled promise
    // per call, so the test can resolve them deliberately out of order —
    // the exact race the generation-counter guard exists for.
    const deferred: { resolve: (rows: unknown[]) => void }[] = [];
    let searchCallCount = 0;
    const db = {
      query: vi.fn((sql: string) => {
        if (/sqlite_master/.test(sql)) {
          return Promise.resolve([{ 1: 1 }]);
        }
        searchCallCount += 1;
        const callIndex = searchCallCount;
        return new Promise((resolve) => {
          deferred[callIndex] = {
            resolve: (rows) => resolve(rows),
          };
        });
      }),
      run: vi.fn(),
      execute: vi.fn(),
      transaction: vi.fn(),
    };
    useDatabaseMock.mockReturnValue({ status: 'ready', db: db as never });
    const { result } = renderHook(() => useSearch());

    // First query ("cat") debounces and its dao.search() call starts.
    act(() => result.current.setQuery('cat'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    // Second query ("cats") debounces and starts its own dao.search() call
    // before the first one has resolved.
    act(() => result.current.setQuery('cats'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    expect(searchCallCount).toBe(2);

    // Resolve the NEWER ("cats") call's FTS query first. DocumentDao.search()
    // also runs a LIKE completeness scan whenever FTS alone doesn't fill the
    // limit (see document.dao.ts's search() doc comment) — that's a 3rd
    // query this deferred-promise mock must resolve too before the hook's
    // dao.search() promise settles.
    await act(async () => {
      deferred[2]?.resolve([{ ...docRow(), name: 'cats-result' }]);
    });
    expect(searchCallCount).toBe(3);
    await act(async () => {
      deferred[3]?.resolve([]); // no extra substring-only matches
    });
    expect(result.current.results.map((d) => d.name)).toEqual(['cats-result']);

    // Resolve the STALE ("cat") call's FTS query, then its own completeness
    // scan (4th query) — the stale response must not overwrite the newer
    // results either way.
    await act(async () => {
      deferred[1]?.resolve([{ ...docRow(), name: 'cat-result' }]);
    });
    expect(searchCallCount).toBe(4);
    await act(async () => {
      deferred[4]?.resolve([]);
    });
    // Still the newer result — the stale one was dropped, not applied.
    expect(result.current.results.map((d) => d.name)).toEqual(['cats-result']);
    expect(result.current.isSearching).toBe(false);
  });

  it('clears results when the query is emptied', async () => {
    const db = new FakeDb()
      .onQuery(/sqlite_master/, [{ 1: 1 }])
      .onQuery(/documents_fts MATCH/, [docRow()]);
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
