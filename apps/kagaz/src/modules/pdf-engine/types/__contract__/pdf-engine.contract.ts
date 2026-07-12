import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { type PdfEngineService, type ProgressEvent } from '../pdf-engine.types';

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

/** A 1×1 PNG, for the images → PDF contract (F-7). */
function tinyPng(): Uint8Array {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** A PDF with one text field ('fullName') and one checkbox ('agree') (F-28). */
async function createTestFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  const form = doc.getForm();
  const name = form.createTextField('fullName');
  name.addToPage(page, { x: 50, y: 120, width: 200, height: 20 });
  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 50, y: 80, width: 15, height: 15 });
  return doc.save();
}

/**
 * True when a real 2D canvas is available. The compressor (@quicktoolsone/
 * pdf-compress) rasterises pages to images, which needs a canvas — jsdom has
 * none, so the byte-reducing path is device-verified rather than run in CI.
 * Merge/split and every validation/error path run everywhere.
 */
const HAS_CANVAS =
  typeof document !== 'undefined' && document.createElement('canvas').getContext('2d') !== null;

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
        const result = await engine.mergePdfs([validPdf1Page, validPdf2Pages], (event) =>
          progressEvents.push(event)
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
        await expect(engine.mergePdfs([validPdf1Page, invalidPdf])).rejects.toThrowError(
          expect.objectContaining({
            code: 'INVALID_PDF',
            operation: 'mergePdfs',
          })
        );
      });

      it('should throw INVALID_PDF if the input list is empty', async () => {
        await expect(engine.mergePdfs([])).rejects.toThrowError(
          expect.objectContaining({
            code: 'INVALID_PDF',
            operation: 'mergePdfs',
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
          { start: 2, end: 2 },
        ];

        const results = await engine.splitPdf(pdf3Pages, ranges, (event) =>
          progressEvents.push(event)
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
          { start: 3, end: 3 },
        ];

        await expect(engine.splitPdf(pdf3Pages, outOfBoundsRanges)).rejects.toThrowError(
          expect.objectContaining({
            code: 'PAGE_OUT_OF_RANGE',
            operation: 'splitPdf',
          })
        );
      });

      it('should throw PAGE_OUT_OF_RANGE if start > end in a range', async () => {
        const pdf3Pages = await createTestPdf(3, 'SplitDoc');

        const invalidRanges = [{ start: 2, end: 1 }];

        await expect(engine.splitPdf(pdf3Pages, invalidRanges)).rejects.toThrowError(
          expect.objectContaining({
            code: 'PAGE_OUT_OF_RANGE',
            operation: 'splitPdf',
          })
        );
      });

      it('should throw INVALID_PDF if input PDF is invalid', async () => {
        const ranges = [{ start: 0, end: 0 }];

        await expect(engine.splitPdf(invalidPdf, ranges)).rejects.toThrowError(
          expect.objectContaining({
            code: 'INVALID_PDF',
            operation: 'splitPdf',
          })
        );
      });
    });

    describe('F-5: PDF Compress', () => {
      // Byte reduction rasterises pages (needs a canvas) — device-verified.
      it.skipIf(!HAS_CANVAS)('should successfully compress a valid PDF', async () => {
        const pdfPages = await createTestPdf(2, 'CompressDoc');
        const progressEvents: ProgressEvent[] = [];

        const compressed = await engine.compressPdf(pdfPages, 'medium', (event) =>
          progressEvents.push(event)
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
        await expect(engine.compressPdf(invalidPdf, 'medium')).rejects.toThrowError(
          expect.objectContaining({
            code: 'INVALID_PDF',
            operation: 'compressPdf',
          })
        );
      });
    });

    describe('F-7: Images → PDF', () => {
      it('should build a one-page PDF from a single image', async () => {
        const result = await engine.imagesToPdf([
          { data: tinyPng(), mimeType: 'image/png' },
        ]);
        expect(result).toBeInstanceOf(Uint8Array);
        expect(await getPageCount(result)).toBe(1);
      });

      it('should build a multi-page PDF from multiple images', async () => {
        const result = await engine.imagesToPdf([
          { data: tinyPng(), mimeType: 'image/png' },
          { data: tinyPng(), mimeType: 'image/png' },
        ]);
        expect(await getPageCount(result)).toBe(2);
      });

      it('should throw UNSUPPORTED_FORMAT for an unsupported image type', async () => {
        await expect(
          engine.imagesToPdf([{ data: tinyPng(), mimeType: 'image/gif' }])
        ).rejects.toThrowError(
          expect.objectContaining({ code: 'UNSUPPORTED_FORMAT' })
        );
      });
    });

    describe('F-62: Watermark', () => {
      it('should stamp every page and keep the page count', async () => {
        const original = await createTestPdf(3);
        const result = await engine.watermarkPdf(original, 'COPY');
        expect(result).toBeInstanceOf(Uint8Array);
        expect(await getPageCount(result)).toBe(3);
        // The stamp adds content, so the output is larger than the source.
        expect(result.byteLength).toBeGreaterThan(original.byteLength);
      });

      it('should reject an empty watermark (UNSUPPORTED_FORMAT)', async () => {
        await expect(
          engine.watermarkPdf(await createTestPdf(1), '   ')
        ).rejects.toThrowError(
          expect.objectContaining({ code: 'UNSUPPORTED_FORMAT' })
        );
      });

      it('should throw INVALID_PDF for invalid input', async () => {
        await expect(engine.watermarkPdf(invalidPdf, 'COPY')).rejects.toThrowError(
          expect.objectContaining({ code: 'INVALID_PDF' })
        );
      });
    });

    describe('F-21 / F-22: Encrypt + Decrypt', () => {
      it('should encrypt a PDF and round-trip it back with decrypt', async () => {
        const original = await createTestPdf(2, 'Secret');
        const encrypted = await engine.encryptPdf(original, 'pa55word');
        expect(encrypted).toBeInstanceOf(Uint8Array);

        // The encrypted bytes can no longer be opened without the password.
        await expect(PDFDocument.load(encrypted)).rejects.toBeTruthy();

        const decrypted = await engine.decryptPdf(encrypted, 'pa55word');
        expect(await getPageCount(decrypted)).toBe(2);
      });

      it('should reject decrypt with the wrong password (WRONG_PASSWORD)', async () => {
        const encrypted = await engine.encryptPdf(
          await createTestPdf(1),
          'correct-horse'
        );
        await expect(engine.decryptPdf(encrypted, 'wrong')).rejects.toThrowError(
          expect.objectContaining({ code: 'WRONG_PASSWORD' })
        );
      });

      it('should require a password to encrypt (PASSWORD_REQUIRED)', async () => {
        await expect(
          engine.encryptPdf(await createTestPdf(1), '')
        ).rejects.toThrowError(
          expect.objectContaining({ code: 'PASSWORD_REQUIRED' })
        );
      });

      it('should reject decrypting a non-encrypted PDF (INVALID_PDF)', async () => {
        await expect(
          engine.decryptPdf(await createTestPdf(1), 'whatever')
        ).rejects.toThrowError(expect.objectContaining({ code: 'INVALID_PDF' }));
      });
    });

    describe('F-28: Form fields', () => {
      it('should list the fillable fields', async () => {
        const fields = await engine.getFormFields(await createTestFormPdf());
        const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
        expect(byName['fullName']?.type).toBe('text');
        expect(byName['agree']?.type).toBe('checkbox');
      });

      it('should fill text + checkbox fields and flatten', async () => {
        const filled = await engine.fillForm(await createTestFormPdf(), {
          fullName: 'Asha Rao',
          agree: 'true',
        });
        expect(filled).toBeInstanceOf(Uint8Array);
        // Flattened → no live form fields remain.
        const reloaded = await PDFDocument.load(filled);
        expect(reloaded.getForm().getFields()).toHaveLength(0);
      });
    });

    describe('F-6: PDF → Images', () => {
      // Rasterising needs a canvas (jsdom has none) — device-verified.
      it.skipIf(!HAS_CANVAS)('should render each page to an image blob', async () => {
        const blobs = await engine.pdfToImages(await createTestPdf(2), {
          format: 'png',
          scale: 1,
        });
        expect(blobs).toHaveLength(2);
        expect(blobs[0]).toBeInstanceOf(Blob);
      });

      // pdfjs itself only loads with browser globals (DOMMatrix, …) — device.
      it.skipIf(!HAS_CANVAS)('should reject an invalid PDF (INVALID_PDF)', async () => {
        await expect(
          engine.pdfToImages(invalidPdf, { format: 'png' })
        ).rejects.toMatchObject({ code: 'INVALID_PDF', operation: 'pdfToImages' });
      });
    });
  });
}
