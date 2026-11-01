import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const {
  isOcrSupported,
  recognizeDocumentText,
  extractPdfTextPerPage,
  pdfToImages,
  readFile,
  writeFile,
  deleteFile,
  update,
  useDatabase,
} = vi.hoisted(() => ({
  isOcrSupported: vi.fn(() => true),
  recognizeDocumentText: vi.fn(),
  extractPdfTextPerPage: vi.fn(),
  pdfToImages: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  update: vi.fn(),
  useDatabase: vi.fn(),
}));
const locale = vi.hoisted((): { value: 'en' | 'hi' } => ({ value: 'en' }));

vi.mock('@/modules/image-engine/services/ocr.service', () => ({
  isOcrSupported,
  recognizeDocumentText,
}));
vi.mock('@/modules/pdf-engine/services/pdf-render-ops', () => ({
  extractPdfTextPerPageImpl: extractPdfTextPerPage,
  pdfToImagesImpl: pdfToImages,
}));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read: readFile, write: writeFile, delete: deleteFile }),
  STORAGE_DIRS: { documents: 'documents', thumbnails: 'thumbnails', temp: 'temp' },
}));
vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase }));
vi.mock('@/core/i18n', () => ({ useLocale: () => ({ locale: locale.value }) }));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    update = update;
  },
}));

import {
  canExtractText,
  canOcr,
  isOcrableType,
  useDocumentOcr,
} from '../useDocumentOcr';

// `fileType` is the stored lowercased EXTENSION (e.g. 'jpg'), not a MIME type —
// the fixtures mirror what the upload pipeline actually persists.
const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({ id: 'd1', filePath: 'documents/d1.jpg', fileType: 'jpg', ...over }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  isOcrSupported.mockReturnValue(true);
  locale.value = 'en';
  useDatabase.mockReturnValue({ db: {}, status: 'ready' });
  recognizeDocumentText.mockResolvedValue('AADHAAR 1234 5678');
  extractPdfTextPerPage.mockResolvedValue(['INVOICE #42 total 999 — plenty of real page text']);
  pdfToImages.mockResolvedValue([new Blob([new Uint8Array([1])])]);
  readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  writeFile.mockResolvedValue(undefined);
  deleteFile.mockResolvedValue(undefined);
  update.mockResolvedValue(1);
});

describe('isOcrableType (regression: extension, not MIME)', () => {
  it('accepts stored image extensions', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'PNG']) {
      expect(isOcrableType(ext)).toBe(true);
    }
  });
  it('rejects non-image extensions', () => {
    for (const ext of ['pdf', 'txt', 'docx', 'heic']) {
      expect(isOcrableType(ext)).toBe(false);
    }
  });
  it('does NOT accept MIME strings (the shape that caused the bug)', () => {
    expect(isOcrableType('image/jpeg')).toBe(false);
  });
});

describe('canOcr', () => {
  it('is true for images on a native platform', () => {
    expect(canOcr(doc())).toBe(true);
  });
  it('is false for non-image documents', () => {
    expect(canOcr(doc({ fileType: 'pdf' }))).toBe(false);
  });
  it('is false when OCR is unsupported (web)', () => {
    isOcrSupported.mockReturnValue(false);
    expect(canOcr(doc())).toBe(false);
  });
});

describe('canExtractText (UX-13)', () => {
  it('is true for images (OCR)', () => {
    expect(canExtractText(doc())).toBe(true);
  });
  it('is true for PDFs (text layer) even when OCR is unsupported', () => {
    isOcrSupported.mockReturnValue(false);
    expect(canExtractText(doc({ fileType: 'pdf' }))).toBe(true);
  });
  it('is false for other types', () => {
    expect(canExtractText(doc({ fileType: 'txt' }))).toBe(false);
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

  it('extracts a PDF text layer and stores it (UX-13)', async () => {
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = null;
    await act(async () => {
      text = await result.current.extractText(
        doc({ filePath: 'documents/d1.pdf', fileType: 'pdf' })
      );
    });
    expect(text).toBe('INVOICE #42 total 999 — plenty of real page text');
    expect(readFile).toHaveBeenCalledWith('documents/d1.pdf');
    expect(extractPdfTextPerPage).toHaveBeenCalled();
    expect(recognizeDocumentText).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith('d1', {
      ocrText: 'INVOICE #42 total 999 — plenty of real page text',
    });
  });

  it('falls back to page OCR when a PDF has no text layer (scanned)', async () => {
    extractPdfTextPerPage.mockResolvedValue(['']); // scanned PDF → empty text layer
    recognizeDocumentText.mockResolvedValue('SCANNED PAGE TEXT');
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = null;
    await act(async () => {
      text = await result.current.extractText(
        doc({ filePath: 'documents/scan.pdf', fileType: 'pdf' })
      );
    });
    expect(text).toBe('SCANNED PAGE TEXT');
    expect(pdfToImages).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pages: [0] })
    );
    expect(recognizeDocumentText).toHaveBeenCalled(); // then OCR'd
    expect(update).toHaveBeenCalledWith('d1', { ocrText: 'SCANNED PAGE TEXT' });
  });

  it('does NOT OCR-fall-back when the PDF text layer has content', async () => {
    const { result } = renderHook(() => useDocumentOcr());
    await act(async () => {
      await result.current.extractText(doc({ filePath: 'documents/d1.pdf', fileType: 'pdf' }));
    });
    expect(pdfToImages).not.toHaveBeenCalled();
    expect(recognizeDocumentText).not.toHaveBeenCalled();
  });

  it('OCRs only the sparse pages — a stamped page number no longer hides missing OCR (F-20 regression)', async () => {
    // Page 1 is real, extractable content; page 2 is a scanned image with
    // just "3" stamped on it by the Page Numbers tool — non-empty, but not
    // real content. The bug: the OLD whole-document check saw *some* text
    // ("… \n\n 3") and never OCR'd page 2 at all.
    extractPdfTextPerPage.mockResolvedValue([
      'This is a full real page of invoice content, easily over the threshold.',
      '3',
    ]);
    recognizeDocumentText.mockResolvedValue('Scanned attachment page content');
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = null;
    await act(async () => {
      text = await result.current.extractText(
        doc({ filePath: 'documents/mixed.pdf', fileType: 'pdf' })
      );
    });
    // Only page index 1 (the sparse one) gets rendered/OCR'd.
    expect(pdfToImages).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pages: [1] })
    );
    expect(recognizeDocumentText).toHaveBeenCalledTimes(1);
    expect(text).toBe(
      'This is a full real page of invoice content, easily over the threshold.\n\nScanned attachment page content'
    );
  });

  it('keeps the native sparse text (e.g. a page number) when OCR itself finds nothing', async () => {
    extractPdfTextPerPage.mockResolvedValue(['3']);
    recognizeDocumentText.mockResolvedValue(''); // OCR found nothing on the page
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = null;
    await act(async () => {
      text = await result.current.extractText(
        doc({ filePath: 'documents/blank-scan.pdf', fileType: 'pdf' })
      );
    });
    expect(text).toBe('3');
  });

  it('is a no-op on a document whose text cannot be extracted', async () => {
    const { result } = renderHook(() => useDocumentOcr());
    let out: string | null = 'x';
    await act(async () => {
      out = await result.current.extractText(doc({ fileType: 'txt' }));
    });
    expect(out).toBeNull();
    expect(recognizeDocumentText).not.toHaveBeenCalled();
    expect(extractPdfTextPerPage).not.toHaveBeenCalled();
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
