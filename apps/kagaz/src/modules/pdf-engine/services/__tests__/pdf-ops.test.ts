import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfsImpl, splitPdfImpl, loadAndValidatePdf } from '../pdf-ops';
import { compressPdfImpl } from '../pdf-compress-ops';
import { type ProgressEvent } from '../../types/pdf-engine.types';
import { compress } from '@quicktoolsone/pdf-compress';

// Mock the heavy WASM compressor
vi.mock('@quicktoolsone/pdf-compress', () => {
  return {
    compress: vi.fn(),
  };
});

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
    vi.mocked(compress).mockImplementation((pdfBuffer, options) => {
      if (options?.onProgress) {
        options.onProgress({
          phase: 'compressing',
          progress: 50,
          currentChunk: 1,
          totalChunks: 1,
          message: 'Compressing images',
        });
      }
      return Promise.resolve({
        pdf: pdfBuffer,
        stats: {
          originalSize: pdfBuffer.byteLength,
          compressedSize: pdfBuffer.byteLength,
          ratio: 1.0,
          bytesSaved: 0,
          percentageSaved: 0,
          presetUsed: options?.preset || 'balanced',
          processingTime: 123,
          chunksProcessed: 1,
        },
      });
    });
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

  describe('compressPdfImpl', () => {
    it('should map compression levels and call compress library', async () => {
      const progress: ProgressEvent[] = [];
      const mockCompress = vi.mocked(compress);

      mockCompress.mockClear();

      const result = await compressPdfImpl(valid2PagePdf, 'medium', (event) =>
        progress.push(event)
      );

      expect(result).toBeInstanceOf(Uint8Array);
      expect(mockCompress).toHaveBeenCalledTimes(1);

      // 'medium' should map to 'balanced' preset
      const firstCallArgs = mockCompress.mock.calls[0];
      const options = firstCallArgs[1];
      expect(options?.preset).toBe('balanced');

      expect(progress.length).toBeGreaterThan(0);
      expect(progress[progress.length - 1].percent).toBe(100);
    });

    it('should map quality low to max preset', async () => {
      const mockCompress = vi.mocked(compress);
      mockCompress.mockClear();

      await compressPdfImpl(valid2PagePdf, 'low');
      const firstCallArgs = mockCompress.mock.calls[0];
      const options = firstCallArgs[1];
      expect(options?.preset).toBe('max');
    });

    it('should map quality high to lossless preset', async () => {
      const mockCompress = vi.mocked(compress);
      mockCompress.mockClear();

      await compressPdfImpl(valid2PagePdf, 'high');
      const firstCallArgs = mockCompress.mock.calls[0];
      const options = firstCallArgs[1];
      expect(options?.preset).toBe('lossless');
    });

    it('should throw error if compression library throws', async () => {
      const mockCompress = vi.mocked(compress);
      mockCompress.mockImplementationOnce(() => Promise.reject(new Error('wasm panic')));

      await expect(compressPdfImpl(valid2PagePdf, 'medium')).rejects.toThrowError(
        expect.objectContaining({
          code: 'COMPRESSION_FAILED',
          operation: 'compressPdf',
        })
      );
    });
  });
});
