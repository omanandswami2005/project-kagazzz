import { PDFDocument } from 'pdf-lib';
import {
  type PdfEngineService,
  type PageRange,
  type CompressionLevel,
  type ProgressCallback,
  PdfEngineException
} from '../types/pdf-engine.types';

export class MockPdfEngineService implements PdfEngineService {
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
    await Promise.resolve();
  }

  async destroy(): Promise<void> {
    this.initialized = false;
    await Promise.resolve();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new PdfEngineException(
        'PDF Engine is not initialized',
        'WORKER_ERROR',
        'ensureInitialized'
      );
    }
  }

  private async validatePdf(pdf: Uint8Array, operation: string): Promise<PDFDocument> {
    try {
      return await PDFDocument.load(pdf);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      throw new PdfEngineException(
        `Invalid PDF: ${error.message}`,
        'INVALID_PDF',
        operation,
        error
      );
    }
  }

  async mergePdfs(pdfs: Uint8Array[], onProgress?: ProgressCallback): Promise<Uint8Array> {
    this.ensureInitialized();
    const op = 'mergePdfs';
    if (!pdfs || pdfs.length === 0) {
      throw new PdfEngineException('No PDFs provided to merge', 'INVALID_PDF', op);
    }

    // Load and validate all documents
    const docs: PDFDocument[] = [];
    for (const pdf of pdfs) {
      docs.push(await this.validatePdf(pdf, op));
    }

    if (onProgress) {
      onProgress({
        operationId: 'mock-merge',
        operation: op,
        percent: 10,
        message: 'Validating PDFs...'
      });
    }

    const mergedDoc = await PDFDocument.create();
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      for (const page of pages) {
        mergedDoc.addPage(page);
      }

      if (onProgress) {
        onProgress({
          operationId: 'mock-merge',
          operation: op,
          percent: Math.round(10 + ((i + 1) / docs.length) * 90),
          message: `Merged document ${i + 1} of ${docs.length}`
        });
      }
    }

    const result = await mergedDoc.save();

    if (onProgress) {
      onProgress({
        operationId: 'mock-merge',
        operation: op,
        percent: 100,
        message: 'Done'
      });
    }

    return result;
  }

  async splitPdf(pdf: Uint8Array, ranges: PageRange[], onProgress?: ProgressCallback): Promise<Uint8Array[]> {
    this.ensureInitialized();
    const op = 'splitPdf';
    const doc = await this.validatePdf(pdf, op);
    const totalPages = doc.getPageCount();

    if (onProgress) {
      onProgress({
        operationId: 'mock-split',
        operation: op,
        percent: 10,
        message: 'Validating split ranges...'
      });
    }

    // Validate ranges
    for (const range of ranges) {
      if (range.start < 0 || range.end >= totalPages || range.start > range.end) {
        throw new PdfEngineException(
          `Page range out of range: ${range.start}-${range.end} (total pages: ${totalPages})`,
          'PAGE_OUT_OF_RANGE',
          op
        );
      }
    }

    const results: Uint8Array[] = [];
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const newDoc = await PDFDocument.create();
      const indices = Array.from(
        { length: range.end - range.start + 1 },
        (_, idx) => range.start + idx
      );
      const pages = await newDoc.copyPages(doc, indices);
      for (const page of pages) {
        newDoc.addPage(page);
      }
      results.push(await newDoc.save());

      if (onProgress) {
        onProgress({
          operationId: 'mock-split',
          operation: op,
          percent: Math.round(10 + ((i + 1) / ranges.length) * 90),
          message: `Split range ${i + 1} of ${ranges.length}`
        });
      }
    }

    if (onProgress) {
      onProgress({
        operationId: 'mock-split',
        operation: op,
        percent: 100,
        message: 'Done'
      });
    }

    return results;
  }

  async compressPdf(pdf: Uint8Array, quality: CompressionLevel, onProgress?: ProgressCallback): Promise<Uint8Array> {
    this.ensureInitialized();
    const op = 'compressPdf';
    // Just validate it and return it as-is for mock
    await this.validatePdf(pdf, op);

    if (onProgress) {
      onProgress({
        operationId: 'mock-compress',
        operation: op,
        percent: 50,
        message: `Compressing with quality ${quality}...`
      });
    }

    if (onProgress) {
      onProgress({
        operationId: 'mock-compress',
        operation: op,
        percent: 100,
        message: 'Done'
      });
    }

    return pdf;
  }
}
