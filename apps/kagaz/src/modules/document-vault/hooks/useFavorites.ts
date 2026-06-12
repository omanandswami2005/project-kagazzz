/**
 * Favorites hook (F-33): loads every favorited document, newest first,
 * for the Favorites tab. Re-runs when the database arrives and whenever
 * the caller bumps `reloadKey` (e.g. after un-favoriting from the list).
 */
import { useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';

const logger = log('document-vault');

/** Loads favorited documents; `reload` forces a refresh after mutations. */
export function useFavorites(reloadKey = 0): {
  favorites: DocumentEntity[];
  isLoading: boolean;
} {
  const { db } = useDatabase();
  const [favorites, setFavorites] = useState<DocumentEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);

  useEffect(() => {
    if (!dao) {
      return;
    }
    // isLoading starts true and is cleared in finally; we intentionally do
    // not flip it back to true on a reloadKey bump — the list refreshes in
    // place (e.g. after un-starring) without a loading flash, and this keeps
    // us clear of the no-setState-in-effect rule.
    let cancelled = false;
    void dao
      .findFavorites()
      .then((rows) => {
        if (!cancelled) {
          setFavorites(rows);
        }
      })
      .catch((error: unknown) => {
        logger.error({
          event: 'vault.favorites.failed',
          err: { message: String(error) },
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [dao, reloadKey]);

  return { favorites, isLoading };
}
