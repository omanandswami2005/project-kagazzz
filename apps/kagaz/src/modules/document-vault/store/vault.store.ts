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

  setDocuments: (documents: DocumentEntity[]) => void;
  prependDocuments: (documents: DocumentEntity[]) => void;
  setLoading: (isLoading: boolean) => void;
  startUpload: () => void;
  setUploadProgress: (progress: UploadProgress) => void;
  finishUpload: (errorKeys: VaultErrorMessageKey[]) => void;
  openUploadSheet: () => void;
  closeUploadSheet: () => void;
}

/** The document-vault Zustand store. */
export const useVaultStore = create<VaultState>((set) => ({
  documents: [],
  isLoading: false,
  isUploading: false,
  uploadProgress: null,
  isUploadSheetOpen: false,
  lastUploadErrors: [],

  setDocuments: (documents): void => set({ documents }),
  prependDocuments: (documents): void =>
    set((state) => ({ documents: [...documents, ...state.documents] })),
  setLoading: (isLoading): void => set({ isLoading }),
  startUpload: (): void =>
    set({ isUploading: true, uploadProgress: null, lastUploadErrors: [] }),
  setUploadProgress: (uploadProgress): void => set({ uploadProgress }),
  finishUpload: (lastUploadErrors): void =>
    set({ isUploading: false, uploadProgress: null, lastUploadErrors }),
  openUploadSheet: (): void => set({ isUploadSheetOpen: true }),
  closeUploadSheet: (): void => set({ isUploadSheetOpen: false }),
}));
