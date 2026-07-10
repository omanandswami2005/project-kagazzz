import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { isOcrSupported, recognizeDocumentText, update, useDatabase } = vi.hoisted(() => ({
  isOcrSupported: vi.fn(() => true),
  recognizeDocumentText: vi.fn(),
  update: vi.fn(),
  useDatabase: vi.fn(),
}));
const locale = vi.hoisted((): { value: 'en' | 'hi' } => ({ value: 'en' }));

vi.mock('@/modules/image-engine/services/ocr.service', () => ({
  isOcrSupported,
  recognizeDocumentText,
}));
vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase }));
vi.mock('@/core/i18n', () => ({ useLocale: () => ({ locale: locale.value }) }));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    update = update;
  },
}));

import { canOcr, useDocumentOcr } from '../useDocumentOcr';

const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({ id: 'd1', filePath: 'documents/d1.jpg', fileType: 'image/jpeg', ...over }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  isOcrSupported.mockReturnValue(true);
  locale.value = 'en';
  useDatabase.mockReturnValue({ db: {}, status: 'ready' });
  recognizeDocumentText.mockResolvedValue('AADHAAR 1234 5678');
  update.mockResolvedValue(1);
});

describe('canOcr', () => {
  it('is true for images on a native platform', () => {
    expect(canOcr(doc())).toBe(true);
  });
  it('is false for non-image documents', () => {
    expect(canOcr(doc({ fileType: 'application/pdf' }))).toBe(false);
  });
  it('is false when OCR is unsupported (web)', () => {
    isOcrSupported.mockReturnValue(false);
    expect(canOcr(doc())).toBe(false);
  });
});

describe('useDocumentOcr (F-20)', () => {
  it('recognizes text and stores it in ocr_text', async () => {
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = null;
    await act(async () => {
      text = await result.current.extractText(doc());
    });
    expect(text).toBe('AADHAAR 1234 5678');
    expect(recognizeDocumentText).toHaveBeenCalledWith('documents/d1.jpg', 'en');
    expect(update).toHaveBeenCalledWith('d1', { ocrText: 'AADHAAR 1234 5678' });
  });

  it('passes the Hindi language through', async () => {
    locale.value = 'hi';
    const { result } = renderHook(() => useDocumentOcr());
    await act(async () => {
      await result.current.extractText(doc());
    });
    expect(recognizeDocumentText).toHaveBeenCalledWith('documents/d1.jpg', 'hi');
  });

  it('is a no-op on a non-image document', async () => {
    const { result } = renderHook(() => useDocumentOcr());
    let out: string | null = 'x';
    await act(async () => {
      out = await result.current.extractText(doc({ fileType: 'application/pdf' }));
    });
    expect(out).toBeNull();
    expect(recognizeDocumentText).not.toHaveBeenCalled();
  });

  it('returns null (no throw) when recognition fails', async () => {
    recognizeDocumentText.mockRejectedValue(new Error('mlkit boom'));
    const { result } = renderHook(() => useDocumentOcr());
    let out: string | null = 'x';
    await act(async () => {
      out = await result.current.extractText(doc());
    });
    expect(out).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
