/**
 * Upload flow hook (02-document-vault-module.md §Upload Pipeline):
 * builds the UploadService over the app's DbConnection + FileStorage,
 * runs the source pickers, and mirrors progress into the vault store.
 */
import { useCallback, useMemo } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { DocumentDao } from '@/infrastructure/database/dao';
import { createFileStorage } from '@/infrastructure/filesystem';
import { useVaultStore } from '../store/vault.store';
import { UploadService } from '../services/upload.service';
import { pickFiles, type UploadSource } from '../services/upload-sources';

/** What {@link useUpload} exposes to pages and actions. */
export interface UseUploadResult {
  /** True until the database is ready for uploads. */
  isReady: boolean;
  /** Picks files from a source and uploads them to the vault root. */
  uploadFrom: (source: UploadSource) => Promise<{ uploaded: number }>;
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
    });
  }, [db]);

  const uploadFrom = useCallback(
    async (source: UploadSource): Promise<{ uploaded: number }> => {
      const store = useVaultStore.getState();
      store.closeUploadSheet();
      if (!service) {
        return { uploaded: 0 };
      }
      const files = await pickFiles(source);
      if (files.length === 0) {
        return { uploaded: 0 };
      }
      store.startUpload();
      try {
        service.onProgress((progress) =>
          useVaultStore.getState().setUploadProgress(progress)
        );
        const result = await service.uploadFiles(files);
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

  return { isReady: status === 'ready' && service !== null, uploadFrom };
}
