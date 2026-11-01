/**
 * Archive hook (F-89). Loads archived documents and exposes unarchive /
 * delete. Simpler than {@link useTrash} — archiving has no retention
 * window or file cleanup, it's a single boolean column, so this needs no
 * dedicated service file.
 *
 * Bug-audit follow-up: `unarchive` also reflects the change into the
 * shared vault store (`prependDocuments`, now folder-scoped — see
 * `vault.store.ts`), not just this hook's own local `items` list. Without
 * that, a document unarchived here stayed invisible on the main vault list
 * until the user changed folders or restarted the app — `VaultHomePage`
 * doesn't remount on Settings → Archived → back (same
 * `IonRouterOutlet`), so its `useDocuments` effect never re-fires to pick
 * it up. Same root cause the F-10 tag-staleness bug had: two independent,
 * non-shared state sources for overlapping document lists.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useVaultStore } from '../store/vault.store';

const logger = log('document-vault');

/** What {@link useArchive} exposes. */
export interface UseArchive {
  /** Archived documents currently hidden from the main list. */
  items: DocumentEntity[];
  /** True while the initial load runs. */
  loading: boolean;
  /** Unarchives a document, returning it to the main vault list. */
  unarchive: (doc: DocumentEntity) => Promise<void>;
  /** Soft-deletes an archived document straight to Trash. */
  deleteToTrash: (doc: DocumentEntity) => Promise<void>;
}

/** Manages the Archived documents view. */
export function useArchive(): UseArchive {
  const { db } = useDatabase();
  const [items, setItems] = useState<DocumentEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);

  useEffect(() => {
    if (!dao) {
      return undefined;
    }
    let cancelled = false;
    void dao.findArchived().then((list) => {
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [dao]);

  const unarchive = useCallback(
    async (doc: DocumentEntity): Promise<void> => {
      if (!dao) {
        return;
      }
      setItems((prev) => prev.filter((d) => d.id !== doc.id));
      try {
        await dao.update(doc.id, { isArchived: false });
        logger.info({ event: 'vault.unarchive', documentId: doc.id });
        // Only actually inserted if this document belongs in whatever
        // folder the main list currently has open — see prependDocuments.
        useVaultStore.getState().prependDocuments([doc]);
      } catch (error) {
        setItems((prev) => [doc, ...prev]);
        logger.error({
          event: 'vault.unarchive.failed',
          documentId: doc.id,
          err: { message: String(error) },
        });
      }
    },
    [dao]
  );

  const deleteToTrash = useCallback(
    async (doc: DocumentEntity): Promise<void> => {
      if (!dao) {
        return;
      }
      setItems((prev) => prev.filter((d) => d.id !== doc.id));
      try {
        await dao.softDelete(doc.id);
        logger.info({ event: 'vault.delete', documentId: doc.id });
      } catch (error) {
        setItems((prev) => [doc, ...prev]);
        logger.error({
          event: 'vault.delete.failed',
          documentId: doc.id,
          err: { message: String(error) },
        });
      }
    },
    [dao]
  );

  return { items, loading, unarchive, deleteToTrash };
}
