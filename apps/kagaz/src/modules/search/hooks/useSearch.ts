/**
 * Search hook (02-document-vault-module.md §Search Engine): debounced
 * FTS5 search over the documents table. Returns the query setter, the
 * current results, and status flags for the vault UI (F-11).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { buildFtsMatchQuery, isSearchable } from '../services/search.service';

const logger = log('search');

/** Debounce window before a query runs (spec §Search Architecture). */
export const SEARCH_DEBOUNCE_MS = 300;

/** What {@link useSearch} exposes. */
export interface UseSearchResult {
  /** Current raw query text. */
  query: string;
  /** Updates the query (debounced search follows). */
  setQuery: (q: string) => void;
  /** True once the query is long enough that results replace the list. */
  isActive: boolean;
  /** True while a debounced search is in flight. */
  isSearching: boolean;
  /** Matches for the active query (rank order). */
  results: DocumentEntity[];
}

/** Debounced full-text search over the vault. */
export function useSearch(): UseSearchResult {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<DocumentEntity[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const isActive = isSearchable(query);

  // The "searching" flag flips in this event handler (not in an effect),
  // so the effect can stay side-effect-free except for scheduling.
  const setQuery = useCallback((next: string): void => {
    setQueryState(next);
    if (isSearchable(next)) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
      setResults([]);
    }
  }, []);

  const run = useCallback(
    async (raw: string): Promise<void> => {
      const match = buildFtsMatchQuery(raw);
      if (!dao || !match) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      try {
        const rows = await dao.search(match, 50);
        // [SEC] SEC-V1 §8 #4: locked documents never appear in search results.
        const visible = rows.filter((row) => !row.isLocked);
        setResults(visible);
        logger.info({ event: 'search.run', resultCount: visible.length });
      } catch (error) {
        setResults([]);
        logger.error({
          event: 'search.failed',
          err: { message: String(error) },
        });
      } finally {
        setIsSearching(false);
      }
    },
    [dao]
  );

  // Debounce only: schedules the query; all setState happens later (in the
  // timer callback), never synchronously in the effect body.
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const id = setTimeout(() => void run(query), SEARCH_DEBOUNCE_MS);
    return (): void => clearTimeout(id);
  }, [query, isActive, run]);

  return { query, setQuery, isActive, isSearching, results };
}
