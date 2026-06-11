/**
 * Upload pipeline (02-document-vault-module.md §Document Upload Flow):
 * validate → convert (HEIC→JPEG, when a converter is wired) → hash →
 * save to FileStorage → insert documents row. Thumbnails land with
 * F-24, auto-OCR with F-20, and the HEIC→JPEG converter with F-8
 * (image-engine owns format conversion; its 700 KB+ wasm decoder would
 * blow the bundle budget here) — until then HEIC files are stored
 * as-is, which FileType supports.
 */
import { log } from '@/core/logging';
import type { DocumentDao } from '@/infrastructure/database/dao';
import type {
  DocumentEntity,
  NewDocument,
} from '@/infrastructure/database/types';
import { STORAGE_DIRS, type FileStorage } from '@/infrastructure/filesystem';
import {
  DocumentVaultError,
  FileType,
  VaultErrorCode,
  type IncomingFile,
  type UploadOptions,
  type UploadProgress,
  type UploadStage,
} from '../types/document.types';
import {
  TYPE_TO_MIME,
  hasSufficientSpace,
  sanitizeName,
  splitFileName,
  validateFile,
} from './file-validation';

const logger = log('document-vault');

/**
 * Converts a HEIC/HEIF blob to JPEG. The implementation arrives with
 * F-8 (image-engine, in a Web Worker); the protocol is defined here so
 * the pipeline's converting stage is already wired and testable.
 */
export type HeicConverter = (blob: Blob) => Promise<Blob>;

/** Everything the pipeline needs, injected (protocol-based design). */
export interface UploadServiceDeps {
  storage: FileStorage;
  /** Document persistence — only `create` is needed by the pipeline. */
  documents: Pick<DocumentDao, 'create'>;
  /** Optional HEIC→JPEG converter (F-8). Absent: HEIC stored as-is. */
  convertHeic?: HeicConverter;
}

/** Outcome of a batch upload: per-file successes and failures. */
export interface UploadBatchResult {
  documents: DocumentEntity[];
  failures: { fileName: string; error: DocumentVaultError }[];
}

/** SHA-256 hex digest (file_hash column; duplicate detection in F-26). */
async function sha256Hex(data: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Per-stage share of a single file's progress window. */
const STAGE_WEIGHT: Record<UploadStage, number> = {
  validating: 0.1,
  converting: 0.4,
  saving: 0.9,
  complete: 1,
};

/**
 * Document upload pipeline (spec §Upload Service Interface). One
 * instance per upload batch context; progress listeners are per
 * instance.
 */
export class UploadService {
  private progressListener: ((progress: UploadProgress) => void) | null = null;

  constructor(private readonly deps: UploadServiceDeps) {}

  /** Registers the (single) progress listener. */
  onProgress(callback: (progress: UploadProgress) => void): void {
    this.progressListener = callback;
  }

  /**
   * Runs every file through the pipeline. A failing file never aborts
   * the batch (spec §Error Handling: always leave a recoverable path) —
   * failures are collected and reported per file.
   */
  async uploadFiles(
    files: IncomingFile[],
    options: UploadOptions = {}
  ): Promise<UploadBatchResult> {
    const result: UploadBatchResult = { documents: [], failures: [] };
    const opId = crypto.randomUUID();
    logger.info({
      event: 'vault.upload.start',
      opId,
      fileCount: files.length,
      folderId: options.folderId ?? null,
    });

    for (const [index, file] of files.entries()) {
      const emit = (stage: UploadStage): void => {
        this.progressListener?.({
          currentFile: index + 1,
          totalFiles: files.length,
          fileName: file.name,
          stage,
          progress: Math.round(
            ((index + STAGE_WEIGHT[stage]) / files.length) * 100
          ),
        });
      };
      try {
        const document = await this.processFile(file, options, emit);
        result.documents.push(document);
        logger.info({
          event: 'vault.upload.success',
          opId,
          documentId: document.id,
          fileType: document.fileType,
          fileSize: document.fileSize,
          source: file.source,
        });
      } catch (error) {
        const vaultError =
          error instanceof DocumentVaultError
            ? error
            : new DocumentVaultError(
                String(error),
                VaultErrorCode.FILE_READ_ERROR,
                true
              );
        result.failures.push({ fileName: file.name, error: vaultError });
        logger.warn({
          event: 'vault.upload.failed',
          opId,
          code: vaultError.code,
          source: file.source,
        });
      }
    }
    return result;
  }

  /**
   * Pipeline for one file: validate → free-space guard → HEIC→JPEG →
   * hash → write `documents/{uuid}.{ext}` → insert documents row.
   * Throws {@link DocumentVaultError} on any failure.
   */
  async processFile(
    file: IncomingFile,
    options: UploadOptions,
    emit: (stage: UploadStage) => void = () => undefined
  ): Promise<DocumentEntity> {
    emit('validating');
    const validation = await validateFile(file.name, file.blob);
    if (!validation.valid) {
      throw new DocumentVaultError(
        `Validation failed for "${file.name}"`,
        validation.code,
        true
      );
    }
    if (!(await hasSufficientSpace(file.blob.size))) {
      throw new DocumentVaultError(
        'Insufficient storage space',
        VaultErrorCode.STORAGE_FULL,
        true
      );
    }

    let { fileType } = validation;
    let blob = file.blob;
    const name = sanitizeName(splitFileName(file.name).base);

    if (fileType === FileType.HEIC && this.deps.convertHeic) {
      emit('converting');
      try {
        blob = await this.deps.convertHeic(blob);
        fileType = FileType.JPG;
      } catch (error) {
        throw new DocumentVaultError(
          `HEIC conversion failed: ${String(error)}`,
          VaultErrorCode.CONVERSION_FAILED,
          true
        );
      }
    }

    emit('saving');
    const data = new Uint8Array(await blob.arrayBuffer());
    const filePath = `${STORAGE_DIRS.documents}/${crypto.randomUUID()}.${fileType}`;
    try {
      await this.deps.storage.write(filePath, data);
    } catch (error) {
      throw new DocumentVaultError(
        `File write failed: ${String(error)}`,
        VaultErrorCode.FILE_WRITE_ERROR,
        true
      );
    }

    const row: NewDocument = {
      name,
      filePath,
      fileType,
      fileSize: data.byteLength,
      fileHash: await sha256Hex(data),
      folderId: options.folderId,
      isFavorite: false,
      isLocked: false,
      isArchived: false,
      language: 'en',
      sourceType: file.source,
      originalFilename: file.name,
    };
    try {
      const document = await this.deps.documents.create(row);
      emit('complete');
      return document;
    } catch (error) {
      // Keep storage consistent: a row that failed to insert must not
      // leave an orphaned file behind.
      await this.deps.storage.delete(filePath).catch(() => undefined);
      throw new DocumentVaultError(
        `Document insert failed: ${String(error)}`,
        VaultErrorCode.DB_QUERY_ERROR,
        false
      );
    }
  }
}

/** Default MIME for a stored file type (UI display + export later). */
export function mimeTypeFor(fileType: string): string {
  return TYPE_TO_MIME[fileType] ?? 'application/octet-stream';
}
