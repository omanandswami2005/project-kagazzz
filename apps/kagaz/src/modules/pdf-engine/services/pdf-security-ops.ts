import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { decryptPDF, isEncrypted } from '@pdfsmaller/pdf-decrypt';
import { loadAndValidatePdf } from './pdf-ops';
import {
  type EncryptOptions,
  type ProgressCallback,
  PdfEngineException,
} from '../types/pdf-engine.types';

/**
 * PDF password security (F-21 encrypt, F-22 decrypt) via @pdfsmaller/pdf-encrypt
 * + pdf-decrypt (AES-256 by default).
 *
 * [SEC] 10-security-architecture: passwords are held in memory only for the
 * operation and are NEVER logged or persisted. No password is placed in a log
 * record, error message, or progress event.
 */

/** Encrypts `pdf` with `password` (AES-256 unless overridden). */
export async function encryptPdfImpl(
  pdf: Uint8Array,
  password: string,
  options: EncryptOptions = {},
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'encryptPdf';
  if (!password) {
    throw new PdfEngineException(
      'A password is required to encrypt a PDF',
      'PASSWORD_REQUIRED',
      op
    );
  }
  // Must be a real, currently-unencrypted PDF.
  await loadAndValidatePdf(pdf, op);

  onProgress?.({
    operationId: 'encrypt',
    operation: op,
    percent: 20,
    message: 'Encrypting…',
  });

  try {
    const result = await encryptPDF(pdf, password, {
      ownerPassword: options.ownerPassword,
      algorithm: options.algorithm ?? 'AES-256',
    });
    onProgress?.({
      operationId: 'encrypt',
      operation: op,
      percent: 100,
      message: 'Done',
    });
    return result;
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    throw new PdfEngineException(
      `Encryption failed: ${error.message}`,
      'ENCRYPTION_FAILED',
      op,
      error
    );
  }
}

/** Decrypts a password-protected `pdf`. Wrong password → WRONG_PASSWORD. */
export async function decryptPdfImpl(
  pdf: Uint8Array,
  password: string,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'decryptPdf';
  if (!password) {
    throw new PdfEngineException(
      'A password is required to decrypt a PDF',
      'PASSWORD_REQUIRED',
      op
    );
  }

  let encryptedStatus: boolean;
  try {
    encryptedStatus = (await isEncrypted(pdf)).encrypted;
  } catch {
    // If we cannot even read the header, treat it as an invalid PDF below.
    encryptedStatus = false;
  }
  if (!encryptedStatus) {
    throw new PdfEngineException(
      'This PDF is not password-protected.',
      'INVALID_PDF',
      op
    );
  }

  onProgress?.({
    operationId: 'decrypt',
    operation: op,
    percent: 20,
    message: 'Decrypting…',
  });

  try {
    const result = await decryptPDF(pdf, password);
    onProgress?.({
      operationId: 'decrypt',
      operation: op,
      percent: 100,
      message: 'Done',
    });
    return result;
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    throw new PdfEngineException(
      'Incorrect password, or the encryption is unsupported.',
      'WRONG_PASSWORD',
      op,
      error
    );
  }
}
