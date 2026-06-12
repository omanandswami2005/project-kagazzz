import { PDFDocument } from 'pdf-lib';
import {
  type PageRange,
  type ProgressCallback,
  PdfEngineException
} from '../types/pdf-engine.types';

/**
 * Validates a Uint8Array as a PDF and loads it.
 */
export async function loadAndValidatePdf(pdf: Uint8Array, operation: string): Promise<PDFDocument> {
  if (!pdf || pdf.length === 0) {
    throw new PdfEngineException(
      'Empty or missing PDF data',
      'INVALID_PDF',
      operation
    );
  }
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

/**
 * Merges multiple PDFs into a single Uint8Array.
 */
export async function mergePdfsImpl(
  pdfs: Uint8Array[],
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'mergePdfs';
  if (!pdfs || pdfs.length === 0) {
    throw new PdfEngineException('No PDFs provided to merge', 'INVALID_PDF', op);
  }

  // Load and validate all documents
  const docs: PDFDocument[] = [];
  for (const pdf of pdfs) {
    docs.push(await loadAndValidatePdf(pdf, op));
  }

  if (onProgress) {
    onProgress({
      operationId: 'merge',
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
        operationId: 'merge',
        operation: op,
        percent: Math.round(10 + ((i + 1) / docs.length) * 90),
        message: `Merged document ${i + 1} of ${docs.length}`
      });
    }
  }

  const result = await mergedDoc.save();

  if (onProgress) {
    onProgress({
      operationId: 'merge',
      operation: op,
      percent: 100,
      message: 'Done'
    });
  }

  return result;
}

/**
 * Splits a PDF into multiple Uint8Arrays according to page ranges.
 */
export async function splitPdfImpl(
  pdf: Uint8Array,
  ranges: PageRange[],
  onProgress?: ProgressCallback
): Promise<Uint8Array[]> {
  const op = 'splitPdf';
  const doc = await loadAndValidatePdf(pdf, op);
  const totalPages = doc.getPageCount();

  if (onProgress) {
    onProgress({
      operationId: 'split',
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
        operationId: 'split',
        operation: op,
        percent: Math.round(10 + ((i + 1) / ranges.length) * 90),
        message: `Split range ${i + 1} of ${ranges.length}`
      });
    }
  }

  if (onProgress) {
    onProgress({
      operationId: 'split',
      operation: op,
      percent: 100,
      message: 'Done'
    });
  }

  return results;
}
