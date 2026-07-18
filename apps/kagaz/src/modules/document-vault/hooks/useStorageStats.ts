/**
 * Storage statistics hook (F-26): loads the vault usage snapshot for the
 * Storage page. Null while loading or when the database is unavailable.
 */
import { useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import {
  buildStorageStats,
  type StorageStats,
} from '../services/storage.service';

const logger = log('document-vault');

/** Returns the storage snapshot (null until loaded). */
export function useStorageStats(): { stats: StorageStats | null } {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    if (!dao) {
      return;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const [totals, usageByType, largest, duplicates] = await Promise.all([
          dao.getStorageTotals(),
          dao.getUsageByType(),
          dao.getLargestDocuments(10),
          dao.getDuplicateStats(),
        ]);
        if (!cancelled) {
          setStats(
            buildStorageStats({ totals, usageByType, largest, duplicates })
          );
        }
      } catch (error) {
        logger.error({
          event: 'vault.storage.load.failed',
          err: { message: String(error) },
        });
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [dao]);

  return { stats };
}
