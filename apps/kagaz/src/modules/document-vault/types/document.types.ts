/**
 * Document-vault domain types
 * (docs/architecture/02-document-vault-module.md §Document Data Model,
 * §Document Upload Flow, §Error Handling).
 */
import type { DocumentSourceType } from '@/infrastructure/database/types';

/** Supported stored file types (spec §Supporting Types). */
export enum FileType {
  PDF = 'pdf',
  JPG = 'jpg',
  JPEG = 'jpeg',
  PNG = 'png',
  HEIC = 'heic',
  WEBP = 'webp',
  TIFF = 'tiff',
  BMP = 'bmp',
  GIF = 'gif',
  DOCX = 'docx',
  TXT = 'txt',
  MD = 'md',
}

/**
 * The file types accepted by the F-1 upload pipeline (camera / gallery /
 * file picker). The remaining FileType values arrive with later items
 * (e.g. scanner output, templates).
 */
export const UPLOADABLE_FILE_TYPES: readonly FileType[] = [
  FileType.PDF,
  FileType.JPG,
  FileType.JPEG,
  FileType.PNG,
  FileType.HEIC,
  FileType.WEBP,
  // Text/Markdown (F-40 PDF→text export saves these; also uploadable).
  FileType.TXT,
  FileType.MD,
  // Word (F-41 PDF→Word export; F-43 opens/views these).
  FileType.DOCX,
];

/** Spec §Validation Rules: max document size. */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** Spec §Validation Rules: name length ceiling after sanitization. */
export const MAX_NAME_LENGTH = 255;

/** Spec §File Validation Rules: required free space = size × this. */
export const FREE_SPACE_FACTOR = 1.5;

/** A file handed to the upload pipeline by an input source. */
export interface IncomingFile {
  /** Original file name including extension (e.g. `PAN_Card.jpg`). */
  name: string;
  /** Raw content. */
  blob: Blob;
  /** Where the file came from (documents.source_type). */
  source: DocumentSourceType;
}

/** Options accepted by the upload pipeline (spec §Upload Service Interface). */
export interface UploadOptions {
  /** Target folder (undefined = vault root). */
  folderId?: string;
  /** Tag ids to assign after creation (lands with F-10). */
  tags?: string[];
}

/** Pipeline stage names (spec §UploadProgress; thumbnail/ocr land later). */
export type UploadStage =
  | 'validating'
  | 'converting'
  | 'saving'
  | 'complete';

/** Progress event emitted once per stage per file. */
export interface UploadProgress {
  /** 1-based index of the file currently processing. */
  currentFile: number;
  totalFiles: number;
  fileName: string;
  stage: UploadStage;
  /** 0–100 across the whole batch. */
  progress: number;
}

/** Validation outcome for a single file. */
export type ValidationResult =
  | { valid: true; fileType: FileType }
  | { valid: false; code: VaultErrorCode };

/** Machine-readable vault error codes (spec §Error Handling). */
export enum VaultErrorCode {
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_NAME = 'INVALID_FILE_NAME',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  STORAGE_FULL = 'STORAGE_FULL',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  DB_QUERY_ERROR = 'DB_QUERY_ERROR',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
}

/** i18n key (documents namespace) for each error's user-facing message. */
export const VAULT_ERROR_MESSAGE_KEYS = {
  [VaultErrorCode.INVALID_FILE_TYPE]: 'upload.errors.invalid_file_type',
  [VaultErrorCode.FILE_TOO_LARGE]: 'upload.errors.file_too_large',
  [VaultErrorCode.INVALID_FILE_NAME]: 'upload.errors.invalid_file_name',
  [VaultErrorCode.CORRUPTED_FILE]: 'upload.errors.corrupted_file',
  [VaultErrorCode.STORAGE_FULL]: 'upload.errors.storage_full',
  [VaultErrorCode.FILE_READ_ERROR]: 'upload.errors.file_read_error',
  [VaultErrorCode.FILE_WRITE_ERROR]: 'upload.errors.file_write_error',
  [VaultErrorCode.DB_QUERY_ERROR]: 'upload.errors.db_error',
  [VaultErrorCode.CONVERSION_FAILED]: 'upload.errors.conversion_failed',
} as const satisfies Record<VaultErrorCode, string>;

/** One of the user-facing error message keys (documents namespace). */
export type VaultErrorMessageKey =
  (typeof VAULT_ERROR_MESSAGE_KEYS)[VaultErrorCode];

/** Typed error every vault operation throws (spec §Error Handling). */
export class DocumentVaultError extends Error {
  /** i18n key for the user-facing message. */
  readonly userMessage: VaultErrorMessageKey;

  constructor(
    message: string,
    readonly code: VaultErrorCode,
    readonly recoverable: boolean,
    readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DocumentVaultError';
    this.userMessage = VAULT_ERROR_MESSAGE_KEYS[code];
  }
}
