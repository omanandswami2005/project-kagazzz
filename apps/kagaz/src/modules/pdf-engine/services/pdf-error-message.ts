/**
 * Maps a machine-readable {@link PdfErrorCode} to the i18n key of the message
 * the PDF Tools sheet should show, so a wrong password (etc.) gets a specific,
 * actionable message instead of the generic failure text. Keys live under the
 * `tools` namespace's `errors.*` block.
 */
import type { PdfErrorCode } from '../types/pdf-engine.types';

/** A `tools` namespace error message key (literal so `t()` accepts it). */
export type PdfErrorMessageKey =
  | 'errors.wrong_password'
  | 'errors.invalid_pdf'
  | 'errors.no_text_layer'
  | 'errors.failed';

/**
 * Returns the `tools:errors.*` key for an engine error code, or `null` when
 * there is no error. Unmapped codes fall back to the generic `errors.failed`.
 */
export function pdfErrorMessageKey(
  code: PdfErrorCode | null | undefined
): PdfErrorMessageKey | null {
  if (code == null) {
    return null;
  }
  switch (code) {
    case 'WRONG_PASSWORD':
      return 'errors.wrong_password';
    case 'INVALID_PDF':
    case 'CORRUPTED_FILE':
    case 'UNSUPPORTED_FORMAT':
      return 'errors.invalid_pdf';
    case 'NO_TEXT_LAYER':
      return 'errors.no_text_layer';
    default:
      return 'errors.failed';
  }
}
