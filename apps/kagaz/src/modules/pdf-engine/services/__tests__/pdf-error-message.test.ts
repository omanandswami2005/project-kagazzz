import { describe, expect, it } from 'vitest';
import type { PdfErrorCode } from '../../types/pdf-engine.types';
import { pdfErrorMessageKey } from '../pdf-error-message';

describe('pdfErrorMessageKey', () => {
  it('maps WRONG_PASSWORD to a password-specific key', () => {
    expect(pdfErrorMessageKey('WRONG_PASSWORD')).toBe('errors.wrong_password');
  });

  it('maps invalid/corrupt/unsupported codes to invalid_pdf', () => {
    const codes: PdfErrorCode[] = ['INVALID_PDF', 'CORRUPTED_FILE', 'UNSUPPORTED_FORMAT'];
    for (const code of codes) {
      expect(pdfErrorMessageKey(code)).toBe('errors.invalid_pdf');
    }
  });

  it('falls back to the generic key for unmapped codes', () => {
    expect(pdfErrorMessageKey('WORKER_ERROR')).toBe('errors.failed');
    expect(pdfErrorMessageKey('OUT_OF_MEMORY')).toBe('errors.failed');
  });

  it('returns null when there is no error', () => {
    expect(pdfErrorMessageKey(null)).toBeNull();
    expect(pdfErrorMessageKey(undefined)).toBeNull();
  });
});
