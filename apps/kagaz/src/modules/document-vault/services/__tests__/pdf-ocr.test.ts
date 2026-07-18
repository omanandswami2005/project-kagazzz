import { describe, expect, it, vi } from 'vitest';
import { ocrScannedPdf, type PdfOcrDeps } from '../pdf-ocr';

/** A tiny blob standing in for a rendered PDF page. */
const page = (): Blob => new Blob([new Uint8Array([1, 2, 3])]);

function deps(over: Partial<PdfOcrDeps> = {}): PdfOcrDeps {
  let n = 0;
  return {
    renderPages: vi.fn(async () => [page(), page()]),
    recognize: vi.fn(async () => 'text'),
    storage: { write: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) },
    uuid: (): string => `id${n++}`,
    ...over,
  };
}

describe('ocrScannedPdf (F-20 scanned-PDF fallback)', () => {
  it('renders pages, OCRs each, and joins the text', async () => {
    const d = deps({
      recognize: vi.fn(async (path: string) => (path.includes('id0') ? 'page one' : 'page two')),
    });
    const out = await ocrScannedPdf(new Uint8Array([0]), 'en', d);
    expect(out).toBe('page one\n\npage two');
    expect(d.recognize).toHaveBeenCalledTimes(2);
  });

  it('writes each page to temp/ and deletes it afterwards', async () => {
    const d = deps();
    await ocrScannedPdf(new Uint8Array([0]), 'en', d);
    expect(d.storage.write).toHaveBeenCalledTimes(2);
    expect(d.storage.delete).toHaveBeenCalledTimes(2);
    // The temp path is under temp/ with a .png extension.
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
    await expect(ocrScannedPdf(new Uint8Array([0]), 'en', d)).rejects.toThrow('mlkit boom');
    expect(d.storage.delete).toHaveBeenCalledTimes(1);
  });

  it('returns empty string when no page has text', async () => {
    const d = deps({ recognize: vi.fn(async () => '   ') });
    expect(await ocrScannedPdf(new Uint8Array([0]), 'en', d)).toBe('');
  });

  it('passes the language through to the recogniser', async () => {
    const d = deps();
    await ocrScannedPdf(new Uint8Array([0]), 'hi', d);
    expect(d.recognize).toHaveBeenCalledWith(expect.any(String), 'hi');
  });
});
