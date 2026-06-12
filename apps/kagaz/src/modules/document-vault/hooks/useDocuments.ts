/**
 * Document list hook: loads the vault root into the store once the
 * database is ready. (The spec's TanStack Query variant waits on a
 * QueryClientProvider in the app shell — tracked for F-9/F-11; the
 * store keeps the same observable surface either way.)
 */
import { useEffect, useMemo } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import { currentFolderId, useVaultStore } from '../store/vault.store';

const logger = log('document-vault');

/** Loads root documents into the vault store; re-runs when db arrives. */
export function useDocuments(): {
  documents: ReturnType<typeof useVaultStore.getState>['documents'];
  isLoading: boolean;
} {
  const { db } = useDatabase();
  const documents = useVaultStore((state) => state.documents);
  const isLoading = useVaultStore((state) => state.isLoading);
  const folderId = useVaultStore(currentFolderId);
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);

  useEffect(() => {
    if (!dao) {
      return;
    }
    let cancelled = false;
    useVaultStore.getState().setLoading(true);
    void dao
      .findByFolder(folderId)
      .then((rows) => {
        if (!cancelled) {
          useVaultStore.getState().setDocuments(rows);
        }
      })
      .catch((error: unknown) => {
        logger.error({
          event: 'vault.list.failed',
          err: { message: String(error) },
        });
      })
      .finally(() => {
        if (!cancelled) {
          useVaultStore.getState().setLoading(false);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [dao, folderId]);

  return { documents, isLoading };
}
