/**
 * Trash hook (F-57). Loads soft-deleted documents and exposes restore /
 * delete-forever / empty-trash. Purges expired items on mount so the Trash
 * view is always within the retention window, then reflects each action
 * optimistically.
 *
 * Bug-audit fix: `restore` now also reflects the change into the shared
 * vault store (`prependDocuments`, folder-scoped — see `vault.store.ts`),
 * not just this hook's own local `items` list — same fix `useArchive.
 * unarchive` already got for the identical root cause (two independent,
 * non-shared state sources for overlapping document lists: without this,
 * a restored document stayed invisible on the main vault list until the
 * user changed folders or restarted the app, since `VaultHomePage` doesn't
 * remount on Settings → Trash → back).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { createFileStorage } from '@/infrastructure/filesystem';
import { useVaultStore } from '../store/vault.store';
import {
  createTrashDeps,
  deleteForever as deleteForeverSvc,
  emptyTrash as emptyTrashSvc,
  purgeExpiredTrash,
} from '../services/trash.service';

const logger = log('document-vault');

/** What {@link useTrash} exposes. */
export interface UseTrash {
  /** Soft-deleted documents currently in the Trash. */
  items: DocumentEntity[];
  /** True while the initial load runs. */
  loading: boolean;
  /** Restores a document back to the vault. */
  restore: (doc: DocumentEntity) => Promise<void>;
  /** Permanently deletes a single document (files + row). */
  deleteForever: (doc: DocumentEntity) => Promise<void>;
  /** Permanently deletes every document in the Trash. */
  emptyTrash: () => Promise<void>;
}

/** Manages the Trash / Recycle Bin view. */
export function useTrash(): UseTrash {
  const { db } = useDatabase();
  const [items, setItems] = useState<DocumentEntity[]>([]);
  const [loading, setLoading] = useState(true);

  const deps = useMemo(() => (db ? createTrashDeps(db, createFileStorage()) : null), [db]);
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);

  useEffect(() => {
    if (!deps) {
      return;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      await purgeExpiredTrash(deps).catch(() => undefined);
      const list = await deps.listTrashed();
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [deps]);

  const restore = useCallback(
    async (doc: DocumentEntity): Promise<void> => {
      if (!dao) {
        return;
      }
      setItems((prev) => prev.filter((d) => d.id !== doc.id));
      try {
        await dao.restore(doc.id);
        logger.info({ event: 'vault.restore', documentId: doc.id });
        // Only actually inserted if this document belongs in whatever
        // folder the main list currently has open — see prependDocuments.
        useVaultStore.getState().prependDocuments([doc]);
      } catch (error) {
        setItems((prev) => [doc, ...prev]);
        logger.error({
          event: 'vault.restore.failed',
          documentId: doc.id,
          err: { message: String(error) },
        });
      }
    },
    [dao]
  );

  const deleteForever = useCallback(
    async (doc: DocumentEntity): Promise<void> => {
      if (!deps) {
        return;
      }
      await deleteForeverSvc(doc, deps);
      setItems((prev) => prev.filter((d) => d.id !== doc.id));
    },
    [deps]
  );

  const emptyTrash = useCallback(async (): Promise<void> => {
    if (!deps) {
      return;
    }
    await emptyTrashSvc(deps);
    setItems([]);
  }, [deps]);

  return { items, loading, restore, deleteForever, emptyTrash };
}
