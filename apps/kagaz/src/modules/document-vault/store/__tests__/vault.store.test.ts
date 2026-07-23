import { beforeEach, describe, expect, it } from 'vitest';
import type { FolderEntity } from '@/infrastructure/database/types';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { currentFolderId, useVaultStore } from '../vault.store';

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
    folderPath: [],
    selectionMode: false,
    selectedIds: [],
  });
});

const folder = (id: string, name: string): FolderEntity => ({
  id,
  name,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
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

  it('manages multi-select state (F-25)', () => {
    useVaultStore.getState().enterSelection('a');
    expect(useVaultStore.getState().selectionMode).toBe(true);
    expect(useVaultStore.getState().selectedIds).toEqual(['a']);
    useVaultStore.getState().toggleSelection('b');
    useVaultStore.getState().toggleSelection('a'); // deselect a
    expect(useVaultStore.getState().selectedIds).toEqual(['b']);
    useVaultStore.getState().selectAll(['a', 'b', 'c']);
    expect(useVaultStore.getState().selectedIds).toEqual(['a', 'b', 'c']);
    useVaultStore.getState().clearSelection();
    expect(useVaultStore.getState().selectionMode).toBe(false);
    expect(useVaultStore.getState().selectedIds).toEqual([]);
  });

  it('navigates folders via the breadcrumb (F-9)', () => {
    expect(currentFolderId(useVaultStore.getState())).toBeNull();
    useVaultStore.getState().enterFolder(folder('a', 'A'));
    useVaultStore.getState().enterFolder(folder('b', 'B'));
    expect(currentFolderId(useVaultStore.getState())).toBe('b');
    expect(useVaultStore.getState().folderPath.map((f) => f.id)).toEqual([
      'a',
      'b',
    ]);
    // Jump back to depth 1 (folder A).
    useVaultStore.getState().goToFolderDepth(1);
    expect(currentFolderId(useVaultStore.getState())).toBe('a');
    // Jump to root.
    useVaultStore.getState().goToFolderDepth(0);
    expect(useVaultStore.getState().folderPath).toEqual([]);
  });

  it('patchDocument updates one document; removeDocument drops it', () => {
    useVaultStore.getState().setDocuments([doc('a'), doc('b')]);
    useVaultStore.getState().patchDocument('a', { isFavorite: true });
    expect(
      useVaultStore.getState().documents.find((d) => d.id === 'a')?.isFavorite
    ).toBe(true);
    useVaultStore.getState().removeDocument('b');
    expect(useVaultStore.getState().documents.map((d) => d.id)).toEqual(['a']);
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

  describe('prependDocuments folder scoping (bug-audit follow-up)', () => {
    it('does not insert a document belonging to a different folder than the one being viewed', () => {
      useVaultStore.getState().enterFolder(folder('f1', 'F1'));
      useVaultStore.getState().setDocuments([doc('a')]);
      const inOtherFolder = { ...doc('b'), folderId: 'f2' };
      useVaultStore.getState().prependDocuments([inOtherFolder]);
      expect(useVaultStore.getState().documents.map((d) => d.id)).toEqual(['a']);
    });

    it('does insert a document that belongs to the folder currently being viewed', () => {
      useVaultStore.getState().enterFolder(folder('f1', 'F1'));
      useVaultStore.getState().setDocuments([doc('a')]);
      const inSameFolder = { ...doc('b'), folderId: 'f1' };
      useVaultStore.getState().prependDocuments([inSameFolder]);
      expect(useVaultStore.getState().documents.map((d) => d.id)).toContain('b');
    });

    it('is a no-op (does not throw, does not change state) when nothing in scope', () => {
      useVaultStore.getState().enterFolder(folder('f1', 'F1'));
      useVaultStore.getState().setDocuments([doc('a')]);
      const before = useVaultStore.getState().documents;
      useVaultStore.getState().prependDocuments([{ ...doc('b'), folderId: 'elsewhere' }]);
      expect(useVaultStore.getState().documents).toBe(before);
    });
  });
});
