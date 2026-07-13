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

/** Where page numbers sit on the page (F-36). */
export type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-right'
  | 'top-left';

/**
 * How each page number reads (F-36):
 * - 'plain'      → `1`
 * - 'page-n'     → `Page 1`
 * - 'n-of-total' → `1 / 12`
 */
export type PageNumberFormat = 'plain' | 'page-n' | 'n-of-total';

/** Options for stamping page numbers (F-36). */
export interface PageNumberOptions {
  /** Corner/edge the number sits in. Default 'bottom-center'. */
  position?: PageNumberPosition;
  /** Text style of the number. Default 'plain'. */
  format?: PageNumberFormat;
  /** Number shown on the first page (1-based). Default 1. */
  startAt?: number;
}

/** An image to place onto a PDF page (F-7, images → PDF). */
export interface ImageInput {
  /** Raw image bytes. */
  data: Uint8Array;
  /** MIME type — only `image/jpeg` and `image/png` are embeddable by pdf-lib. */
  mimeType: string;
}

/** Options for rendering PDF pages to images (F-6, PDF → image). */
export interface RenderOptions {
  /** Output raster format. */
  format: 'png' | 'jpeg';
  /** Scale factor (1 = 72 DPI, 2 = 144 DPI, …). Default 2. */
  scale?: number;
  /** Specific 0-indexed pages to render (undefined = all). */
  pages?: number[];
  /** JPEG quality (0–1, JPEG only). Default 0.92. */
  quality?: number;
}

/** Encryption options (F-21). Defaults to AES-256 with a user password. */
export interface EncryptOptions {
  /** Separate owner (permissions) password. Defaults to the user password. */
  ownerPassword?: string;
  /** Cipher; AES-256 is the secure default. */
  algorithm?: 'AES-256' | 'RC4';
}

/**
 * Editable document metadata (F-39). All fields are plain strings for the
 * form; `keywords` is a comma-separated list (split into pdf-lib's string[]
 * at the write boundary). Empty string means "not set".
 */
export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

/** A fillable form field discovered in a PDF (F-28). */
export interface FormField {
  /** Internal field name (the key used to fill it). */
  name: string;
  /** Field kind. */
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'button' | 'signature';
  /** Current value as a string ('true'/'false' for checkboxes). */
  value: string;
  /** Selectable options for radio/dropdown/optionlist fields. */
  options?: string[];
}

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
  | 'NO_TEXT_LAYER'
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

/**
 * Reads the error code + details off an unknown error by shape, not by
 * `instanceof`. A `PdfEngineException` thrown inside a worker is a *different*
 * class instance than the one the worker entry imports (separate module realm),
 * so `instanceof` returns false there; duck-typing keeps the code intact.
 */
export function pdfErrorInfoOf(e: unknown): {
  code: PdfErrorCode;
  details?: Record<string, unknown>;
} {
  if (
    e !== null &&
    typeof e === 'object' &&
    'code' in e &&
    typeof (e as PdfEngineError).code === 'string'
  ) {
    const err = e as PdfEngineError;
    return { code: err.code, details: err.details };
  }
  return { code: 'UNKNOWN' };
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

  /** Combine one or more images into a single PDF (F-7) */
  imagesToPdf(images: ImageInput[], onProgress?: ProgressCallback): Promise<Uint8Array>;

  /** Stamp a diagonal text watermark across every page (F-37) */
  watermarkPdf(
    pdf: Uint8Array,
    text: string,
    onProgress?: ProgressCallback
  ): Promise<Uint8Array>;

  /** Stamp sequential page numbers onto every page (F-36) */
  addPageNumbers(
    pdf: Uint8Array,
    options: PageNumberOptions,
    onProgress?: ProgressCallback
  ): Promise<Uint8Array>;

  /** Extract the embedded text layer of a PDF as plain text (F-40) */
  extractText(pdf: Uint8Array): Promise<string>;

  /** Render PDF pages to image blobs (F-6) */
  pdfToImages(
    pdf: Uint8Array,
    options: RenderOptions,
    onProgress?: ProgressCallback
  ): Promise<Blob[]>;

  /** Encrypt a PDF with a password (F-21, AES-256 by default) */
  encryptPdf(
    pdf: Uint8Array,
    password: string,
    options?: EncryptOptions
  ): Promise<Uint8Array>;

  /** Decrypt a password-protected PDF (F-22) */
  decryptPdf(pdf: Uint8Array, password: string): Promise<Uint8Array>;

  /** Read the document's metadata (F-39) */
  getMetadata(pdf: Uint8Array): Promise<PdfMetadata>;

  /** Overwrite the document's metadata (F-39) */
  setMetadata(pdf: Uint8Array, metadata: PdfMetadata): Promise<Uint8Array>;

  /** List the fillable form fields in a PDF (F-28) */
  getFormFields(pdf: Uint8Array): Promise<FormField[]>;

  /** Fill form fields by name and flatten the result (F-28) */
  fillForm(pdf: Uint8Array, values: Record<string, string>): Promise<Uint8Array>;

  /** Initialize the engine (preload WASM, spawn workers) */
  initialize(): Promise<void>;

  /** Terminate all workers and free resources */
  destroy(): Promise<void>;
}
