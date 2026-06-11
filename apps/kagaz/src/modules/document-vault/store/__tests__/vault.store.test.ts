import { beforeEach, describe, expect, it } from 'vitest';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { useVaultStore } from '../vault.store';

const doc = (id: string): ReturnType<typeof entityFromNew> =>
  entityFromNew(
    {
      name: id,
      filePath: `documents/${id}.pdf`,
      fileType: 'pdf',
      fileSize: 1,
      isFavorite: false,
      isLocked: false,
      isArchived: false,
      language: 'en',
      sourceType: 'file_picker',
    },
    id
  );

// entityFromNew stamps a fixed createdAt, so default-sort ties break on id.

beforeEach(() => {
  useVaultStore.setState({
    documents: [],
    isLoading: false,
    isUploading: false,
    uploadProgress: null,
    isUploadSheetOpen: false,
    lastUploadErrors: [],
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });
});

describe('vault.store', () => {
  it('sets and prepends documents', () => {
    useVaultStore.getState().setDocuments([doc('a')]);
    useVaultStore.getState().prependDocuments([doc('b')]);
    expect(useVaultStore.getState().documents.map((d) => d.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('tracks the upload lifecycle', () => {
    const store = useVaultStore.getState();
    store.startUpload();
    expect(useVaultStore.getState().isUploading).toBe(true);

    store.setUploadProgress({
      currentFile: 1,
      totalFiles: 1,
      fileName: 'a.pdf',
      stage: 'saving',
      progress: 90,
    });
    expect(useVaultStore.getState().uploadProgress?.stage).toBe('saving');

    store.finishUpload(['upload.errors.file_too_large']);
    const after = useVaultStore.getState();
    expect(after.isUploading).toBe(false);
    expect(after.uploadProgress).toBeNull();
    expect(after.lastUploadErrors).toEqual(['upload.errors.file_too_large']);
  });

  it('opens and closes the upload sheet', () => {
    useVaultStore.getState().openUploadSheet();
    expect(useVaultStore.getState().isUploadSheetOpen).toBe(true);
    useVaultStore.getState().closeUploadSheet();
    expect(useVaultStore.getState().isUploadSheetOpen).toBe(false);
  });

  it('toggles the loading flag', () => {
    useVaultStore.getState().setLoading(true);
    expect(useVaultStore.getState().isLoading).toBe(true);
  });

  it('keeps documents sorted when set, and re-sorts on sort change (F-34)', () => {
    const a = doc('a');
    const b = doc('b');
    const c = doc('c');
    // Default sort is createdAt desc; all share createdAt, so id desc.
    useVaultStore.getState().setDocuments([a, b, c]);
    expect(useVaultStore.getState().documents.map((d) => d.id)).toEqual([
      'c',
      'b',
      'a',
    ]);

    useVaultStore.getState().setSortBy('name');
    useVaultStore.getState().toggleSortDirection(); // desc -> asc
    expect(useVaultStore.getState().sortDirection).toBe('asc');
    expect(useVaultStore.getState().documents.map((d) => d.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('prepended uploads land in sorted position', () => {
    useVaultStore.getState().setSortBy('name');
    useVaultStore.getState().toggleSortDirection(); // asc
    useVaultStore.getState().setDocuments([doc('a'), doc('c')]);
    useVaultStore.getState().prependDocuments([doc('b')]);
    expect(useVaultStore.getState().documents.map((d) => d.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
