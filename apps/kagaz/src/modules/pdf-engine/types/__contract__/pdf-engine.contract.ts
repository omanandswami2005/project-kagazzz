import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  type PdfEngineService,
  type ProgressEvent
} from '../pdf-engine.types';

/**
 * Helper to generate a valid PDF with a specific number of pages.
 */
async function createTestPdf(pagesCount: number, textPrefix = 'Page'): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pagesCount; i++) {
    const page = pdfDoc.addPage([600, 800]);
    page.drawText(`${textPrefix} ${i + 1}`, { x: 50, y: 400 });
  }
  return pdfDoc.save();
}

/**
 * Helper to read page count from a PDF byte array.
 */
async function getPageCount(pdfBytes: Uint8Array): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

export function pdfEngineContract(makeEngine: () => Promise<PdfEngineService>): void {
  describe('PdfEngineService Contract (Lane B: F-3, F-4, F-5)', () => {
    let engine: PdfEngineService;
    let validPdf1Page: Uint8Array;
    let validPdf2Pages: Uint8Array;
    let invalidPdf: Uint8Array;

    beforeAll(async () => {
      engine = await makeEngine();
      await engine.initialize();
      validPdf1Page = await createTestPdf(1, 'DocA');
      validPdf2Pages = await createTestPdf(2, 'DocB');
      invalidPdf = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    afterAll(async () => {
      if (engine) {
        await engine.destroy();
      }
    });

    describe('F-3: PDF Merge', () => {
      it('should merge two valid PDFs into a single document with correct page count', async () => {
        const progressEvents: ProgressEvent[] = [];
        const result = await engine.mergePdfs(
          [validPdf1Page, validPdf2Pages],
          (event) => progressEvents.push(event)
        );

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);

        const count = await getPageCount(result);
        expect(count).toBe(3);

        // Verify progress callback was triggered
        if (progressEvents.length > 0) {
          expect(progressEvents[progressEvents.length - 1].percent).toBe(100);
          expect(progressEvents[progressEvents.length - 1].operation).toBe('mergePdfs');
        }
      });

      it('should throw INVALID_PDF if any of the input PDFs are invalid', async () => {
        await expect(
          engine.mergePdfs([validPdf1Page, invalidPdf])
        ).rejects.toThrowError(
          expect.objectContaining({
            code: 'INVALID_PDF',
            operation: 'mergePdfs'
          })
        );
      });

      it('should throw INVALID_PDF if the input list is empty', async () => {
        await expect(
          engine.mergePdfs([])
        ).rejects.toThrowError(
          expect.objectContaining({
            code: 'INVALID_PDF',
            operation: 'mergePdfs'
          })
        );
      });
    });

    describe('F-4: PDF Split', () => {
      it('should split a PDF into sub-documents according to page ranges', async () => {
        // Create a 3-page PDF
        const pdf3Pages = await createTestPdf(3, 'SplitDoc');
        const progressEvents: ProgressEvent[] = [];

        // Split: range 0-1 (2 pages), range 2-2 (1 page)
        const ranges = [
          { start: 0, end: 1 },
          { start: 2, end: 2 }
        ];

        const results = await engine.splitPdf(
          pdf3Pages,
          ranges,
          (event) => progressEvents.push(event)
        );

        expect(results).toHaveLength(2);
        expect(results[0]).toBeInstanceOf(Uint8Array);
        expect(results[1]).toBeInstanceOf(Uint8Array);

        expect(await getPageCount(results[0])).toBe(2);
        expect(await getPageCount(results[1])).toBe(1);

        // Verify progress callback
        if (progressEvents.length > 0) {
          expect(progressEvents[progressEvents.length - 1].percent).toBe(100);
          expect(progressEvents[progressEvents.length - 1].operation).toBe('splitPdf');
        }
      });

      it('should throw PAGE_OUT_OF_RANGE if a range is out of bounds', async () => {
        const pdf3Pages = await createTestPdf(3, 'SplitDoc');

        // Range out of bounds (start page 3 does not exist for a 3-page PDF)
        const outOfBoundsRanges = [
          { start: 0, end: 1 },
          { start: 3, end: 3 }
        ];

        await expect(
          engine.splitPdf(pdf3Pages, outOfBoundsRanges)
        ).rejects.toThrowError(
          expect.objectContaining({
            code: 'PAGE_OUT_OF_RANGE',
            operation: 'splitPdf'
          })
        );
      });

      it('should throw PAGE_OUT_OF_RANGE if start > end in a range', async () => {
        const pdf3Pages = await createTestPdf(3, 'SplitDoc');

        const invalidRanges = [
          { start: 2, end: 1 }
        ];

        await expect(
          engine.splitPdf(pdf3Pages, invalidRanges)
        ).rejects.toThrowError(
          expect.objectContaining({
            code: 'PAGE_OUT_OF_RANGE',
            operation: 'splitPdf'
          })
        );
      });

      it('should throw INVALID_PDF if input PDF is invalid', async () => {
        const ranges = [{ start: 0, end: 0 }];

        await expect(
          engine.splitPdf(invalidPdf, ranges)
        ).rejects.toThrowError(
          expect.objectContaining({
            code: 'INVALID_PDF',
            operation: 'splitPdf'
          })
        );
      });
    });

    describe('F-5: PDF Compress', () => {
      it('should successfully compress a valid PDF', async () => {
        const pdfPages = await createTestPdf(2, 'CompressDoc');
        const progressEvents: ProgressEvent[] = [];

        const compressed = await engine.compressPdf(
          pdfPages,
          'medium',
          (event) => progressEvents.push(event)
        );

        expect(compressed).toBeInstanceOf(Uint8Array);
        expect(compressed.length).toBeGreaterThan(0);
        expect(await getPageCount(compressed)).toBe(2);

        // Verify progress callback
        if (progressEvents.length > 0) {
          expect(progressEvents[progressEvents.length - 1].percent).toBe(100);
          expect(progressEvents[progressEvents.length - 1].operation).toBe('compressPdf');
        }
      });

      it('should throw INVALID_PDF if input PDF is invalid', async () => {
        await expect(
          engine.compressPdf(invalidPdf, 'medium')
        ).rejects.toThrowError(
          expect.objectContaining({
            code: 'INVALID_PDF',
            operation: 'compressPdf'
          })
        );
      });
    });
  });
}
