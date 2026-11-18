// Gemma vision transcription mode of useDocumentOcr. Separate from
// useDocumentOcr.test.ts because the recognizer is resolved once at import:
// configuring it here would change that file's "no vision fallback" baseline.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const m = vi.hoisted(() => ({
  isOcrSupported: vi.fn(),
  recognizeDocumentText: vi.fn(),
  extractPdfTextPerPage: vi.fn(),
  pdfToImages: vi.fn(),
  readFile: vi.fn(),
  update: vi.fn(),
  vision: vi.fn(),
}));

vi.mock('@/modules/image-engine/services/ocr.service', () => ({
  isOcrSupported: m.isOcrSupported,
  recognizeDocumentText: m.recognizeDocumentText,
}));
vi.mock('@/modules/image-engine/services/vision-ocr.service', () => ({
  getConfiguredVisionRecognizer: () => m.vision,
}));
vi.mock('@/modules/pdf-engine/services/pdf-render-ops', () => ({
  extractPdfTextPerPageImpl: m.extractPdfTextPerPage,
  pdfToImagesImpl: m.pdfToImages,
}));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read: m.readFile, write: vi.fn(), delete: vi.fn() }),
  STORAGE_DIRS: { documents: 'documents', thumbnails: 'thumbnails', temp: 'temp' },
}));
vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: () => ({ db: {}, status: 'ready' }) }));
vi.mock('@/core/i18n', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    update = m.update;
  },
}));
vi.mock('../useDocLock', () => ({ useDocLock: () => ({ authorizeView: () => Promise.resolve(true) }) }));

import { canTranscribeWithVision, useDocumentOcr } from '../useDocumentOcr';

const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({ id: 'd1', filePath: 'documents/d1.jpg', fileType: 'jpg', ...over }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  m.isOcrSupported.mockReturnValue(true); // native ML Kit present: vision must still be selectable
  m.recognizeDocumentText.mockResolvedValue('MLKIT TEXT');
  m.vision.mockResolvedValue('GEMMA TEXT');
  m.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  m.pdfToImages.mockImplementation((_pdf: Uint8Array, opts: { pages?: number[] }) =>
    Promise.resolve((opts.pages ?? []).map(() => new Blob([new Uint8Array([1])])))
  );
  m.update.mockResolvedValue(1);
});

describe('canTranscribeWithVision', () => {
  it('is true for images and PDFs, false for other types', () => {
    expect(canTranscribeWithVision(doc({ fileType: 'png' }))).toBe(true);
    expect(canTranscribeWithVision(doc({ fileType: 'pdf' }))).toBe(true);
    expect(canTranscribeWithVision(doc({ fileType: 'docx' }))).toBe(false);
  });
});

describe('extractText({ engine: "vision" })', () => {
  it('uses Gemma for an image even when native ML Kit is available, and overwrites stored text', async () => {
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = null;
    await act(async () => {
      text = await result.current.extractText(doc(), { engine: 'vision' });
    });
    expect(text).toBe('GEMMA TEXT');
    expect(m.recognizeDocumentText).not.toHaveBeenCalled();
    expect(m.update).toHaveBeenCalledWith('d1', { ocrText: 'GEMMA TEXT' });
  });

  it('transcribes EVERY pdf page with Gemma, even pages that already have a text layer', async () => {
    m.extractPdfTextPerPage.mockResolvedValue([
      'Page one has plenty of real embedded text content here',
      'Page two also has plenty of real embedded text content',
    ]);
    m.vision.mockResolvedValueOnce('GEMMA P1').mockResolvedValueOnce('GEMMA P2');
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = null;
    await act(async () => {
      text = await result.current.extractText(doc({ fileType: 'pdf', filePath: 'documents/d1.pdf' }), {
        engine: 'vision',
      });
    });
    expect(m.pdfToImages).toHaveBeenCalledWith(expect.any(Uint8Array), expect.objectContaining({ pages: [0, 1] }));
    expect(text).toBe('GEMMA P1\n\nGEMMA P2');
  });

  it('keeps the existing text layer for a page Gemma returned nothing for', async () => {
    m.extractPdfTextPerPage.mockResolvedValue(['Embedded text that is long enough to count as real content']);
    m.vision.mockResolvedValueOnce('');
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = null;
    await act(async () => {
      text = await result.current.extractText(doc({ fileType: 'pdf' }), { engine: 'vision' });
    });
    expect(text).toBe('Embedded text that is long enough to count as real content');
  });

  it('returns null for a type Gemma is not fed (docx)', async () => {
    const { result } = renderHook(() => useDocumentOcr());
    let text: string | null = 'x';
    await act(async () => {
      text = await result.current.extractText(doc({ fileType: 'docx' }), { engine: 'vision' });
    });
    expect(text).toBeNull();
    expect(m.vision).not.toHaveBeenCalled();
  });

  it('default (auto) mode still prefers native ML Kit when present', async () => {
    const { result } = renderHook(() => useDocumentOcr());
    await act(async () => {
      await result.current.extractText(doc());
    });
    expect(m.recognizeDocumentText).toHaveBeenCalled();
    expect(m.vision).not.toHaveBeenCalled();
  });
});
