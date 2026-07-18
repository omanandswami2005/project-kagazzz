/**
 * Vault store (02-document-vault-module.md §Module File Structure):
 * document list + upload flow state. Folder navigation, filters, and
 * sort arrive with F-9/F-12/F-34.
 */
import { create } from 'zustand';
import type {
  DocumentEntity,
  FolderEntity,
} from '@/infrastructure/database/types';
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
import { EMPTY_FILTERS, type DocumentFilters } from '../services/filter.service';

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
  /** Folder path from root to the current folder (F-9); [] = root. */
  folderPath: FolderEntity[];
  /** Active document filters (F-12). */
  filters: DocumentFilters;
  /** Whether multi-select mode is active (F-25). */
  selectionMode: boolean;
  /** Ids of the selected documents (F-25). */
  selectedIds: string[];

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
  /** Enters a folder, appending it to the breadcrumb (F-9). */
  enterFolder: (folder: FolderEntity) => void;
  /** Jumps to a breadcrumb depth (0 = root, n = nth folder in the path). */
  goToFolderDepth: (depth: number) => void;
  /** Replaces the active filters (F-12). */
  setFilters: (filters: DocumentFilters) => void;
  /** Clears all filters (F-12). */
  clearFilters: () => void;
  /** Enters multi-select with one document pre-selected (F-25). */
  enterSelection: (id: string) => void;
  /** Toggles a document in the selection (F-25). */
  toggleSelection: (id: string) => void;
  /** Selects every id passed (F-25). */
  selectAll: (ids: string[]) => void;
  /** Exits multi-select and clears the selection (F-25). */
  clearSelection: () => void;
}

/** The id of the folder currently being viewed (null = root). */
export function currentFolderId(state: VaultState): string | null {
  return state.folderPath.at(-1)?.id ?? null;
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
  folderPath: [],
  filters: EMPTY_FILTERS,
  selectionMode: false,
  selectedIds: [],

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
  enterFolder: (folder): void =>
    set((state) => ({ folderPath: [...state.folderPath, folder] })),
  goToFolderDepth: (depth): void =>
    set((state) => ({ folderPath: state.folderPath.slice(0, depth) })),
  setFilters: (filters): void => set({ filters }),
  clearFilters: (): void => set({ filters: EMPTY_FILTERS }),
  enterSelection: (id): void => set({ selectionMode: true, selectedIds: [id] }),
  toggleSelection: (id): void =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id],
    })),
  selectAll: (ids): void => set({ selectionMode: true, selectedIds: ids }),
  clearSelection: (): void => set({ selectionMode: false, selectedIds: [] }),
}));
