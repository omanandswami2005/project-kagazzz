/**
 * Trash hook (F-57). Loads soft-deleted documents and exposes restore /
 * delete-forever / empty-trash. Purges expired items on mount so the Trash
 * view is always within the retention window, then reflects each action
 * optimistically.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { createFileStorage } from '@/infrastructure/filesystem';
import {
  createTrashDeps,
  deleteForever as deleteForeverSvc,
  emptyTrash as emptyTrashSvc,
  purgeExpiredTrash,
} from '../services/trash.service';

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
      await dao.restore(doc.id);
      setItems((prev) => prev.filter((d) => d.id !== doc.id));
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
