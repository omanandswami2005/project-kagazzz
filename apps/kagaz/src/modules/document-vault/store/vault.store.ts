/**
 * Vault store (02-document-vault-module.md §Module File Structure):
 * document list + upload flow state. Folder navigation, filters, and
 * sort arrive with F-9/F-12/F-34.
 */
import { create } from 'zustand';
import type { DocumentEntity } from '@/infrastructure/database/types';
import type {
  UploadProgress,
  VaultErrorMessageKey,
} from '../types/document.types';
import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEY,
  sortDocuments,
  type SortDirection,
  type SortKey,
} from '../services/sort.service';

/** State + actions for the vault screens. */
export interface VaultState {
  /** Documents currently shown (vault root until F-9). */
  documents: DocumentEntity[];
  /** True while the initial document list loads. */
  isLoading: boolean;
  /** True while an upload batch is running. */
  isUploading: boolean;
  /** Last progress event of the running batch (null when idle). */
  uploadProgress: UploadProgress | null;
  /** Whether the upload options sheet is open. */
  isUploadSheetOpen: boolean;
  /** i18n keys of the failures from the last batch (toast surface). */
  lastUploadErrors: VaultErrorMessageKey[];
  /** Active sort key (F-34). `documents` is kept sorted by it. */
  sortBy: SortKey;
  /** Active sort direction (F-34). */
  sortDirection: SortDirection;

  setDocuments: (documents: DocumentEntity[]) => void;
  prependDocuments: (documents: DocumentEntity[]) => void;
  /** Replaces fields of one document in the list (e.g. favorite toggle). */
  patchDocument: (id: string, patch: Partial<DocumentEntity>) => void;
  /** Removes a document from the list (e.g. delete). */
  removeDocument: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  startUpload: () => void;
  setUploadProgress: (progress: UploadProgress) => void;
  finishUpload: (errorKeys: VaultErrorMessageKey[]) => void;
  openUploadSheet: () => void;
  closeUploadSheet: () => void;
  /** Sets the sort key (default desc for dates/size, asc for text). */
  setSortBy: (key: SortKey) => void;
  /** Flips ascending/descending and re-sorts. */
  toggleSortDirection: () => void;
}

/** The document-vault Zustand store. */
export const useVaultStore = create<VaultState>((set) => ({
  documents: [],
  isLoading: false,
  isUploading: false,
  uploadProgress: null,
  isUploadSheetOpen: false,
  lastUploadErrors: [],
  sortBy: DEFAULT_SORT_KEY,
  sortDirection: DEFAULT_SORT_DIRECTION,

  setDocuments: (documents): void =>
    set((state) => ({
      documents: sortDocuments(documents, state.sortBy, state.sortDirection),
    })),
  prependDocuments: (documents): void =>
    set((state) => ({
      documents: sortDocuments(
        [...documents, ...state.documents],
        state.sortBy,
        state.sortDirection
      ),
    })),
  patchDocument: (id, patch): void =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, ...patch } : d
      ),
    })),
  removeDocument: (id): void =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
    })),
  setLoading: (isLoading): void => set({ isLoading }),
  startUpload: (): void =>
    set({ isUploading: true, uploadProgress: null, lastUploadErrors: [] }),
  setUploadProgress: (uploadProgress): void => set({ uploadProgress }),
  finishUpload: (lastUploadErrors): void =>
    set({ isUploading: false, uploadProgress: null, lastUploadErrors }),
  openUploadSheet: (): void => set({ isUploadSheetOpen: true }),
  closeUploadSheet: (): void => set({ isUploadSheetOpen: false }),
  setSortBy: (key): void =>
    set((state) => ({
      sortBy: key,
      documents: sortDocuments(state.documents, key, state.sortDirection),
    })),
  toggleSortDirection: (): void =>
    set((state) => {
      const sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      return {
        sortDirection,
        documents: sortDocuments(state.documents, state.sortBy, sortDirection),
      };
    }),
}));
