/**
 * Type definitions for the PDF Engine Module.
 * Based on docs/architecture/03-pdf-engine-module.md.
 */

export interface PageRange {
  /** Start page (0-indexed, inclusive) */
  start: number;
  /** End page (0-indexed, inclusive) */
  end: number;
}

/**
 * Compression quality levels.
 * - 'low'    → aggressive compression, smaller file, lower image quality
 * - 'medium' → balanced compression (recommended default)
 * - 'high'   → light compression, preserves quality
 */
export type CompressionLevel = 'low' | 'medium' | 'high';

export interface ProgressEvent {
  /** Operation identifier */
  operationId: string;
  /** Operation type (e.g. 'mergePdfs', 'splitPdf', 'compressPdf') */
  operation: string;
  /** 0–100 percentage */
  percent: number;
  /** Human-readable status message */
  message: string;
  /** Current step / total steps (for multi-step ops) */
  currentStep?: number;
  totalSteps?: number;
  /** Bytes processed (for I/O-bound ops) */
  bytesProcessed?: number;
  totalBytes?: number;
}

export type ProgressCallback = (event: ProgressEvent) => void;

export type PdfErrorCode =
  | 'INVALID_PDF'
  | 'PASSWORD_REQUIRED'
  | 'WRONG_PASSWORD'
  | 'CORRUPTED_FILE'
  | 'PAGE_OUT_OF_RANGE'
  | 'UNSUPPORTED_FORMAT'
  | 'WORKER_ERROR'
  | 'WASM_LOAD_FAILED'
  | 'OCR_LANGUAGE_NOT_AVAILABLE'
  | 'COMPRESSION_FAILED'
  | 'ENCRYPTION_FAILED'
  | 'OUT_OF_MEMORY'
  | 'OPERATION_CANCELLED'
  | 'UNKNOWN';

export interface PdfEngineError {
  /** Machine-readable error code */
  code: PdfErrorCode;
  /** Human-readable message */
  message: string;
  /** Original error (if wrapping a library error) */
  cause?: Error;
  /** Operation that failed */
  operation: string;
  /** Additional context */
  details?: Record<string, unknown>;
}

export class PdfEngineException extends Error implements PdfEngineError {
  public code: PdfErrorCode;
  public operation: string;
  public details?: Record<string, unknown>;
  public override cause?: Error;

  constructor(
    message: string,
    code: PdfErrorCode,
    operation: string,
    cause?: Error,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PdfEngineException';
    this.code = code;
    this.operation = operation;
    this.cause = cause;
    this.details = details;

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Unified PDF Engine Service.
 * All methods are async and run heavy work in Web Workers.
 * All Uint8Array parameters represent raw PDF bytes.
 */
export interface PdfEngineService {
  /** Merge multiple PDFs into a single document */
  mergePdfs(pdfs: Uint8Array[], onProgress?: ProgressCallback): Promise<Uint8Array>;

  /** Split a PDF into multiple documents by page ranges */
  splitPdf(
    pdf: Uint8Array,
    ranges: PageRange[],
    onProgress?: ProgressCallback
  ): Promise<Uint8Array[]>;

  /** Compress a PDF to reduce file size */
  compressPdf(
    pdf: Uint8Array,
    quality: CompressionLevel,
    onProgress?: ProgressCallback
  ): Promise<Uint8Array>;

  /** Initialize the engine (preload WASM, spawn workers) */
  initialize(): Promise<void>;

  /** Terminate all workers and free resources */
  destroy(): Promise<void>;
}
