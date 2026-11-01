import { describe, expect, it, vi } from 'vitest';
import { ocrPdfPages, type PdfOcrNativeDeps } from '../pdf-ocr';

/** A tiny blob standing in for a rendered PDF page. */
const page = (): Blob => new Blob([new Uint8Array([1, 2, 3])]);

function deps(over: Partial<PdfOcrNativeDeps> = {}): PdfOcrNativeDeps {
  let n = 0;
  return {
    renderPages: vi.fn(async () => [page(), page()]),
    recognize: vi.fn(async () => 'text'),
    storage: { write: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) },
    uuid: (): string => `id${n++}`,
    ...over,
  };
}

describe('ocrPdfPages (F-20 per-page OCR)', () => {
  it('renders exactly the given pages, OCRs each, and returns text in order', async () => {
    const d = deps({
      recognize: vi.fn(async (path: string) => (path.includes('id0') ? 'page one' : 'page two')),
    });
    const out = await ocrPdfPages(new Uint8Array([0]), [2, 5], 'en', d);
    expect(out).toEqual(['page one', 'page two']);
    expect(d.renderPages).toHaveBeenCalledWith(expect.any(Uint8Array), [2, 5]);
    expect(d.recognize).toHaveBeenCalledTimes(2);
  });

  it('returns [] without rendering anything for an empty page list', async () => {
    const d = deps();
    const out = await ocrPdfPages(new Uint8Array([0]), [], 'en', d);
    expect(out).toEqual([]);
    expect(d.renderPages).not.toHaveBeenCalled();
  });

  it('writes each page to temp/ and deletes it afterwards', async () => {
    const d = deps();
    await ocrPdfPages(new Uint8Array([0]), [0, 1], 'en', d);
    expect(d.storage.write).toHaveBeenCalledTimes(2);
    expect(d.storage.delete).toHaveBeenCalledTimes(2);
    const firstWrite = (d.storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(firstWrite).toMatch(/^temp\/pdf-ocr-.*\.png$/);
  });

  it('deletes the temp page even when recognition throws', async () => {
    const d = deps({
      renderPages: vi.fn(async () => [page()]),
      recognize: vi.fn(async () => {
        throw new Error('mlkit boom');
      }),
    });
    await expect(ocrPdfPages(new Uint8Array([0]), [0], 'en', d)).rejects.toThrow('mlkit boom');
    expect(d.storage.delete).toHaveBeenCalledTimes(1);
  });

  it('preserves position for a page where nothing was recognised (does not drop it)', async () => {
    const d = deps({
      renderPages: vi.fn(async () => [page(), page()]),
      recognize: vi.fn(async (path: string) => (path.includes('id0') ? '   ' : 'page two')),
    });
    const out = await ocrPdfPages(new Uint8Array([0]), [0, 1], 'en', d);
    expect(out).toEqual(['', 'page two']);
  });

  it('passes the language through to the recogniser', async () => {
    const d = deps();
    await ocrPdfPages(new Uint8Array([0]), [0, 1], 'hi', d);
    expect(d.recognize).toHaveBeenCalledWith(expect.any(String), 'hi');
  });
  it('uses recognizeImage directly (no temp files) when given the vision fallback', async () => {
    const recognizeImage = vi.fn().mockResolvedValueOnce(' page one ').mockResolvedValueOnce('page two');
    const renderPages = vi.fn().mockResolvedValue([new Blob(['a']), new Blob(['b'])]);

    const out = await ocrPdfPages(new Uint8Array([1]), [0, 1], 'en', { renderPages, recognizeImage });

    expect(out).toEqual(['page one', 'page two']);
    expect(renderPages).toHaveBeenCalledWith(expect.any(Uint8Array), [0, 1]);
  });
});
