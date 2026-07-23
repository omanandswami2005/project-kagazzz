/**
 * Archive hook (F-89). Loads archived documents and exposes unarchive /
 * delete. Simpler than {@link useTrash} — archiving has no retention
 * window or file cleanup, it's a single boolean column, so this needs no
 * dedicated service file.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';

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
