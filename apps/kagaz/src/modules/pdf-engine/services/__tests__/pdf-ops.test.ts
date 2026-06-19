import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfsImpl, splitPdfImpl, loadAndValidatePdf } from '../pdf-ops';
import { compressPdfImpl } from '../pdf-compress-ops';
import { pdfToImagesImpl } from '../pdf-render-ops';
import { type ProgressEvent } from '../../types/pdf-engine.types';

// Compression rasterises each page via pdfjs (needs a canvas — device only),
// so mock the render step. The compress logic under test is the validate →
// render → rebuild orchestration (rebuild uses real pdf-lib embedJpg).
vi.mock('../pdf-render-ops', () => ({
  pdfToImagesImpl: vi.fn(),
}));

/** A real 1×1 JPEG so pdf-lib's embedJpg can parse it during rebuild. */
const TINY_JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
      'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB' +
      'AAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q=='
  ),
  (c) => c.charCodeAt(0)
);

/** A 1×1 JPEG blob stand-in for a rendered page. */
function fakePageBlob(): Blob {
  return new Blob([TINY_JPEG], { type: 'image/jpeg' });
}

async function createTestPdf(pagesCount: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pagesCount; i++) {
    const page = pdfDoc.addPage([200, 300]);
    page.drawText(`Page ${i + 1}`);
  }
  return pdfDoc.save();
}

describe('PDF Engine Core Operations Implementation', () => {
  let valid1PagePdf: Uint8Array;
  let valid2PagePdf: Uint8Array;
  let invalidPdf: Uint8Array;

  beforeEach(() => {
    // Default: render yields one fake JPEG per requested behaviour.
    vi.mocked(pdfToImagesImpl).mockResolvedValue([fakePageBlob()]);
  });

  beforeAll(async () => {
    valid1PagePdf = await createTestPdf(1);
    valid2PagePdf = await createTestPdf(2);
    invalidPdf = new Uint8Array([1, 2, 3, 4, 5]);
  });

  describe('loadAndValidatePdf', () => {
    it('should load a valid PDF successfully', async () => {
      const doc = await loadAndValidatePdf(valid1PagePdf, 'test');
      expect(doc).toBeInstanceOf(PDFDocument);
      expect(doc.getPageCount()).toBe(1);
    });

    it('should throw INVALID_PDF if PDF is empty', async () => {
      await expect(loadAndValidatePdf(new Uint8Array(0), 'test')).rejects.toThrowError(
        expect.objectContaining({
          code: 'INVALID_PDF',
          operation: 'test',
        })
      );
    });

    it('should throw INVALID_PDF if PDF bytes are corrupt', async () => {
      await expect(loadAndValidatePdf(invalidPdf, 'test')).rejects.toThrowError(
        expect.objectContaining({
          code: 'INVALID_PDF',
          operation: 'test',
        })
      );
    });
  });

  describe('mergePdfsImpl', () => {
    it('should merge documents and report progress', async () => {
      const progress: ProgressEvent[] = [];
      const result = await mergePdfsImpl([valid1PagePdf, valid2PagePdf], (event) =>
        progress.push(event)
      );

      expect(result).toBeInstanceOf(Uint8Array);

      const mergedDoc = await PDFDocument.load(result);
      expect(mergedDoc.getPageCount()).toBe(3);

      expect(progress.length).toBeGreaterThan(0);
      expect(progress[progress.length - 1].percent).toBe(100);
      expect(progress[progress.length - 1].message).toBe('Done');
    });

    it('should throw error if input list is empty', async () => {
      await expect(mergePdfsImpl([])).rejects.toThrowError(
        expect.objectContaining({
          code: 'INVALID_PDF',
          operation: 'mergePdfs',
        })
      );
    });
  });

  describe('splitPdfImpl', () => {
    it('should split document into parts and report progress', async () => {
      const threePagePdf = await createTestPdf(3);
      const progress: ProgressEvent[] = [];

      const parts = await splitPdfImpl(
        threePagePdf,
        [
          { start: 0, end: 1 },
          { start: 2, end: 2 },
        ],
        (event) => progress.push(event)
      );

      expect(parts).toHaveLength(2);
      expect((await PDFDocument.load(parts[0])).getPageCount()).toBe(2);
      expect((await PDFDocument.load(parts[1])).getPageCount()).toBe(1);

      expect(progress.length).toBeGreaterThan(0);
      expect(progress[progress.length - 1].percent).toBe(100);
    });

    it('should throw PAGE_OUT_OF_RANGE if start index is negative', async () => {
      await expect(splitPdfImpl(valid2PagePdf, [{ start: -1, end: 0 }])).rejects.toThrowError(
        expect.objectContaining({
          code: 'PAGE_OUT_OF_RANGE',
          operation: 'splitPdf',
        })
      );
    });

    it('should throw PAGE_OUT_OF_RANGE if end index is out of bounds', async () => {
      await expect(splitPdfImpl(valid2PagePdf, [{ start: 0, end: 2 }])).rejects.toThrowError(
        expect.objectContaining({
          code: 'PAGE_OUT_OF_RANGE',
          operation: 'splitPdf',
        })
      );
    });

    it('should throw PAGE_OUT_OF_RANGE if start > end', async () => {
      await expect(splitPdfImpl(valid2PagePdf, [{ start: 1, end: 0 }])).rejects.toThrowError(
        expect.objectContaining({
          code: 'PAGE_OUT_OF_RANGE',
          operation: 'splitPdf',
        })
      );
    });
  });

  describe('compressPdfImpl (rasterise-and-rebuild)', () => {
    it('renders the PDF to JPEGs and rebuilds a valid PDF', async () => {
      vi.mocked(pdfToImagesImpl).mockResolvedValue([fakePageBlob(), fakePageBlob()]);

      const result = await compressPdfImpl(valid2PagePdf, 'medium');

      expect(result).toBeInstanceOf(Uint8Array);
      // Rebuilt from 2 rendered pages → a loadable 2-page PDF.
      const reloaded = await PDFDocument.load(result);
      expect(reloaded.getPageCount()).toBe(2);
    });

    it('renders as JPEG and maps quality to a scale + JPEG quality', async () => {
      vi.mocked(pdfToImagesImpl).mockResolvedValue([fakePageBlob()]);

      await compressPdfImpl(valid2PagePdf, 'low');
      const [, options] = vi.mocked(pdfToImagesImpl).mock.calls[0];
      expect(options.format).toBe('jpeg');
      expect(options.scale).toBeLessThanOrEqual(1); // 'low' = smallest
      expect(options.quality).toBeLessThan(0.6);
    });

    it('reports completion progress', async () => {
      const progress: ProgressEvent[] = [];
      await compressPdfImpl(valid2PagePdf, 'high', (e) => progress.push(e));
      expect(progress.at(-1)?.percent).toBe(100);
    });

    it('rejects an invalid PDF before rendering (INVALID_PDF)', async () => {
      await expect(compressPdfImpl(invalidPdf, 'medium')).rejects.toThrowError(
        expect.objectContaining({ code: 'INVALID_PDF', operation: 'compressPdf' })
      );
      expect(pdfToImagesImpl).not.toHaveBeenCalled();
    });

    it('wraps a render failure as COMPRESSION_FAILED', async () => {
      vi.mocked(pdfToImagesImpl).mockRejectedValueOnce(new Error('render boom'));
      await expect(compressPdfImpl(valid2PagePdf, 'medium')).rejects.toThrowError(
        expect.objectContaining({
          code: 'COMPRESSION_FAILED',
          operation: 'compressPdf',
        })
      );
    });
  });
});
