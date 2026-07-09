/**
 * Document mutations hook (F-33 favorites; extended by F-25 bulk ops).
 * Persists a change through the DocumentDao, then patches the vault
 * store optimistically so the list reflects it immediately.
 */
import { useCallback, useMemo } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useVaultStore } from '../store/vault.store';

const logger = log('document-vault');

/** What {@link useVaultMutations} exposes. */
export interface UseVaultMutationsResult {
  /** Flips a document's favorite flag (persisted + reflected in the list). */
  toggleFavorite: (document: DocumentEntity) => Promise<void>;
  /** Sets a document's per-document lock flag (F-16/SEC-V1 #4). */
  setLocked: (document: DocumentEntity, locked: boolean) => Promise<void>;
  /** Records that a document was opened, for the Recent list (F-32). */
  markAccessed: (document: DocumentEntity) => Promise<void>;
}

/** Wires per-document mutations to the DAO + store. */
export function useVaultMutations(): UseVaultMutationsResult {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);

  const toggleFavorite = useCallback(
    async (document: DocumentEntity): Promise<void> => {
      if (!dao) {
        return;
      }
      const next = !document.isFavorite;
      // Optimistic: update UI now, reconcile/rollback on failure.
      useVaultStore.getState().patchDocument(document.id, { isFavorite: next });
      try {
        await dao.update(document.id, { isFavorite: next });
        logger.info({
          event: 'vault.favorite.toggle',
          documentId: document.id,
          isFavorite: next,
        });
      } catch (error) {
        useVaultStore
          .getState()
          .patchDocument(document.id, { isFavorite: document.isFavorite });
        logger.error({
          event: 'vault.favorite.failed',
          documentId: document.id,
          err: { message: String(error) },
        });
      }
    },
    [dao]
  );

  const setLocked = useCallback(
    async (document: DocumentEntity, locked: boolean): Promise<void> => {
      if (!dao) {
        return;
      }
      useVaultStore.getState().patchDocument(document.id, { isLocked: locked });
      try {
        await dao.update(document.id, { isLocked: locked });
        logger.info({
          event: 'vault.lock.set',
          documentId: document.id,
          isLocked: locked,
        });
      } catch (error) {
        useVaultStore
          .getState()
          .patchDocument(document.id, { isLocked: document.isLocked });
        logger.error({
          event: 'vault.lock.failed',
          documentId: document.id,
          err: { message: String(error) },
        });
      }
    },
    [dao]
  );

  const markAccessed = useCallback(
    async (document: DocumentEntity): Promise<void> => {
      if (!dao) {
        return;
      }
      try {
        await dao.touchLastAccessed(document.id);
        logger.debug({ event: 'vault.open', documentId: document.id });
      } catch (error) {
        logger.error({
          event: 'vault.open.failed',
          documentId: document.id,
          err: { message: String(error) },
        });
      }
    },
    [dao]
  );

  return { toggleFavorite, setLocked, markAccessed };
}
