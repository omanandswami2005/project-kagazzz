/**
 * Bulk operations hook (02-document-vault-module.md §Bulk Operations):
 * delete / move / favorite on the multi-selected documents (F-25).
 * Persists through the DocumentDao, reflects the result in the vault
 * store, and exits selection mode when done.
 */
import { useCallback, useMemo } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import { currentFolderId, useVaultStore } from '../store/vault.store';

const logger = log('document-vault');

/** What {@link useBulkActions} exposes. */
export interface UseBulkActionsResult {
  /** Soft-deletes every selected document. */
  bulkDelete: () => Promise<number>;
  /** Moves every selected document into a folder (null = root). */
  bulkMove: (folderId: string | null) => Promise<number>;
  /** Marks every selected document as a favorite. */
  bulkFavorite: () => Promise<number>;
}

/** Runs a mutation over the current selection and reports the count done. */
function useSelectionMutation(): {
  run: (
    op: (dao: DocumentDao, id: string) => Promise<unknown>,
    event: string,
    reflect: (id: string) => void
  ) => Promise<number>;
} {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);

  const run = useCallback(
    async (
      op: (dao: DocumentDao, id: string) => Promise<unknown>,
      event: string,
      reflect: (id: string) => void
    ): Promise<number> => {
      const ids = useVaultStore.getState().selectedIds;
      if (!dao || ids.length === 0) {
        return 0;
      }
      let done = 0;
      for (const id of ids) {
        try {
          await op(dao, id);
          reflect(id);
          done += 1;
        } catch (error) {
          logger.error({
            event: `${event}.failed`,
            documentId: id,
            err: { message: String(error) },
          });
        }
      }
      logger.info({ event, count: done });
      useVaultStore.getState().clearSelection();
      return done;
    },
    [dao]
  );

  return { run };
}

/** Drops a document from the current list (delete/move). */
const dropFromList = (id: string): void =>
  useVaultStore.getState().removeDocument(id);

/** Bulk delete / move / favorite over the selected documents. */
export function useBulkActions(): UseBulkActionsResult {
  const { run } = useSelectionMutation();

  const bulkDelete = useCallback(
    () => run((dao, id) => dao.softDelete(id), 'vault.bulk.delete', dropFromList),
    [run]
  );

  const bulkMove = useCallback(
    (folderId: string | null) =>
      run(
        (dao, id) => dao.update(id, { folderId }),
        'vault.bulk.move',
        // Bug-audit fix: only drop from the visible list when the
        // destination actually differs from the folder being viewed — see
        // moveDocument's identical fix in useFolders.ts for the full
        // reasoning (moving to the same folder is a reachable no-op via
        // MoveToFolderDialog and used to make selected docs vanish).
        (id) => {
          if (folderId !== currentFolderId(useVaultStore.getState())) {
            dropFromList(id);
          }
        }
      ),
    [run]
  );

  const bulkFavorite = useCallback(
    () =>
      run((dao, id) => dao.update(id, { isFavorite: true }), 'vault.bulk.favorite', (id) =>
        useVaultStore.getState().patchDocument(id, { isFavorite: true })
      ),
    [run]
  );

  return { bulkDelete, bulkMove, bulkFavorite };
}
