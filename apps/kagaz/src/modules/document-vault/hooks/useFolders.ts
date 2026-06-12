/**
 * Folder data hook (F-9): the subfolders of the current folder plus the
 * folder mutations (create / rename / delete) and moving a document into
 * a folder. Backed by FolderDao + DocumentDao; refreshes after each
 * change and removes a moved document from the current list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao, FolderDao } from '@/infrastructure/database/dao';
import type { FolderEntity } from '@/infrastructure/database/types';
import { currentFolderId, useVaultStore } from '../store/vault.store';

const logger = log('document-vault');

/** What {@link useFolders} exposes. */
export interface UseFoldersResult {
  /** Subfolders of the current folder. */
  folders: FolderEntity[];
  /** Creates a folder in the current folder. */
  createFolder: (name: string) => Promise<FolderEntity | null>;
  /** Renames a folder. */
  renameFolder: (id: string, name: string) => Promise<void>;
  /** Deletes a folder (children cascade; its documents fall back to root). */
  deleteFolder: (id: string) => Promise<void>;
  /** Moves a document into a folder (null = root) and drops it from view. */
  moveDocument: (documentId: string, folderId: string | null) => Promise<void>;
}

/** Loads subfolders for the current folder and exposes folder mutations. */
export function useFolders(): UseFoldersResult {
  const { db } = useDatabase();
  const folderDao = useMemo(() => (db ? new FolderDao(db) : null), [db]);
  const documentDao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);
  const parentId = useVaultStore(currentFolderId);
  const [folders, setFolders] = useState<FolderEntity[]>([]);

  const load = useCallback(async (): Promise<void> => {
    if (!folderDao) {
      return;
    }
    try {
      setFolders(await folderDao.findChildren(parentId));
    } catch (error) {
      logger.error({
        event: 'vault.folders.load.failed',
        err: { message: String(error) },
      });
    }
  }, [folderDao, parentId]);

  useEffect(() => {
    if (!folderDao) {
      return;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const children = await folderDao.findChildren(parentId);
        if (!cancelled) {
          setFolders(children);
        }
      } catch (error) {
        logger.error({
          event: 'vault.folders.load.failed',
          err: { message: String(error) },
        });
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [folderDao, parentId]);

  const createFolder = useCallback(
    async (name: string): Promise<FolderEntity | null> => {
      if (!folderDao) {
        return null;
      }
      const folder = await folderDao.create({
        name: name.trim(),
        parentId: parentId ?? undefined,
        sortOrder: folders.length,
      });
      logger.info({ event: 'vault.folder.create', folderId: folder.id });
      await load();
      return folder;
    },
    [folderDao, parentId, folders.length, load]
  );

  const renameFolder = useCallback(
    async (id: string, name: string): Promise<void> => {
      if (!folderDao) {
        return;
      }
      await folderDao.update(id, { name: name.trim() });
      await load();
    },
    [folderDao, load]
  );

  const deleteFolder = useCallback(
    async (id: string): Promise<void> => {
      if (!folderDao) {
        return;
      }
      await folderDao.delete(id);
      logger.info({ event: 'vault.folder.delete', folderId: id });
      await load();
    },
    [folderDao, load]
  );

  const moveDocument = useCallback(
    async (documentId: string, folderId: string | null): Promise<void> => {
      if (!documentDao) {
        return;
      }
      await documentDao.update(documentId, { folderId });
      // Drop it from the current list (it now lives elsewhere).
      useVaultStore.getState().removeDocument(documentId);
      logger.info({ event: 'vault.document.move', documentId, folderId });
    },
    [documentDao]
  );

  return { folders, createFolder, renameFolder, deleteFolder, moveDocument };
}
