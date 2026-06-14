/**
 * Upload flow hook (02-document-vault-module.md §Upload Pipeline):
 * builds the UploadService over the app's DbConnection + FileStorage,
 * runs the source pickers, and mirrors progress into the vault store.
 */
import { useCallback, useMemo } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { DocumentDao } from '@/infrastructure/database/dao';
import { createFileStorage } from '@/infrastructure/filesystem';
import { currentFolderId, useVaultStore } from '../store/vault.store';
import { UploadService } from '../services/upload.service';
import { pickFiles, type UploadSource } from '../services/upload-sources';
import { generateThumbnail } from '../services/thumbnail.service';
import type { IncomingFile } from '../types/document.types';

/** What {@link useUpload} exposes to pages and actions. */
export interface UseUploadResult {
  /** True until the database is ready for uploads. */
  isReady: boolean;
  /** Picks files from a source and uploads them to the current folder. */
  uploadFrom: (source: UploadSource) => Promise<{ uploaded: number }>;
  /**
   * Persists already-prepared files through the same pipeline (validate →
   * hash → store → row), used by producers that build their own blob — e.g.
   * the PDF Tools outputs. Reports progress + errors via the vault store
   * exactly like {@link uploadFrom}.
   */
  ingestFiles: (files: IncomingFile[]) => Promise<{ uploaded: number }>;
}

/** Wires the upload pipeline into React state. */
export function useUpload(): UseUploadResult {
  const { status, db } = useDatabase();

  const service = useMemo(() => {
    if (!db) {
      return null;
    }
    return new UploadService({
      storage: createFileStorage(),
      documents: new DocumentDao(db),
      makeThumbnail: (blob, fileType): Promise<Uint8Array | null> =>
        generateThumbnail(blob, fileType),
    });
  }, [db]);

  const ingestFiles = useCallback(
    async (files: IncomingFile[]): Promise<{ uploaded: number }> => {
      const store = useVaultStore.getState();
      if (!service || files.length === 0) {
        return { uploaded: 0 };
      }
      store.startUpload();
      try {
        service.onProgress((progress) =>
          useVaultStore.getState().setUploadProgress(progress)
        );
        // Persist into the folder the user is currently viewing (null =
        // root) so the document appears where they are.
        const result = await service.uploadFiles(files, {
          folderId: currentFolderId(store) ?? undefined,
        });
        useVaultStore
          .getState()
          .prependDocuments(
            [...result.documents].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            )
          );
        useVaultStore
          .getState()
          .finishUpload(
            result.failures.map(({ error }) => error.userMessage)
          );
        return { uploaded: result.documents.length };
      } catch (error) {
        useVaultStore.getState().finishUpload(['upload.errors.file_read_error']);
        throw error;
      }
    },
    [service]
  );

  const uploadFrom = useCallback(
    async (source: UploadSource): Promise<{ uploaded: number }> => {
      useVaultStore.getState().closeUploadSheet();
      const files = await pickFiles(source);
      return ingestFiles(files);
    },
    [ingestFiles]
  );

  return {
    isReady: status === 'ready' && service !== null,
    uploadFrom,
    ingestFiles,
  };
}
