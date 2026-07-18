/**
 * Recent-documents hook (F-32): the last-opened documents for the vault
 * home's "Recent" strip. Re-queries whenever the document list changes
 * (uploads, opens, favorite toggles) so the strip stays fresh.
 */
import { useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useVaultStore } from '../store/vault.store';

const logger = log('document-vault');

/** Returns up to `limit` most-recently-opened documents. */
export function useRecentDocuments(limit = 10): DocumentEntity[] {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);
  // Recency changes track document-list changes (open/upload/delete).
  const documents = useVaultStore((s) => s.documents);
  const [recent, setRecent] = useState<DocumentEntity[]>([]);

  useEffect(() => {
    if (!dao) {
      return;
    }
    let cancelled = false;
    void dao
      .findRecent(limit)
      .then((rows) => {
        if (!cancelled) {
          setRecent(rows);
        }
      })
      .catch((error: unknown) => {
        logger.error({
          event: 'vault.recent.failed',
          err: { message: String(error) },
        });
      });
    return (): void => {
      cancelled = true;
    };
  }, [dao, limit, documents]);

  return recent;
}
