import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import {
  type ImageInput,
  type PageRange,
  type ProgressCallback,
  PdfEngineException,
} from '../types/pdf-engine.types';

/**
 * Validates a Uint8Array as a PDF and loads it.
 */
export async function loadAndValidatePdf(pdf: Uint8Array, operation: string): Promise<PDFDocument> {
  if (!pdf || pdf.length === 0) {
    throw new PdfEngineException('Empty or missing PDF data', 'INVALID_PDF', operation);
  }
  try {
    return await PDFDocument.load(pdf);
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    throw new PdfEngineException(`Invalid PDF: ${error.message}`, 'INVALID_PDF', operation, error);
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
      message: 'Validating PDFs...',
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
        message: `Merged document ${i + 1} of ${docs.length}`,
      });
    }
  }

  const result = await mergedDoc.save();

  if (onProgress) {
    onProgress({
      operationId: 'merge',
      operation: op,
      percent: 100,
      message: 'Done',
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
      message: 'Validating split ranges...',
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
        message: `Split range ${i + 1} of ${ranges.length}`,
      });
    }
  }

  if (onProgress) {
    onProgress({
      operationId: 'split',
      operation: op,
      percent: 100,
      message: 'Done',
    });
  }

  return results;
}

/** Embeddable image MIME types (pdf-lib supports JPEG + PNG). */
const JPEG_TYPES = new Set(['image/jpeg', 'image/jpg']);

/**
 * Builds a single PDF from images, one image per page sized to the image
 * (F-7). Only JPEG and PNG embed in pdf-lib.
 */
export async function imagesToPdfImpl(
  images: ImageInput[],
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'imagesToPdf';
  if (!images || images.length === 0) {
    throw new PdfEngineException('No images provided', 'UNSUPPORTED_FORMAT', op);
  }

  const doc = await PDFDocument.create();
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const type = image.mimeType.toLowerCase();
    let embedded;
    try {
      if (JPEG_TYPES.has(type)) {
        embedded = await doc.embedJpg(image.data);
      } else if (type === 'image/png') {
        embedded = await doc.embedPng(image.data);
      } else {
        throw new PdfEngineException(
          `Unsupported image type "${image.mimeType}" — use JPEG or PNG`,
          'UNSUPPORTED_FORMAT',
          op
        );
      }
    } catch (e: unknown) {
      if (e instanceof PdfEngineException) {
        throw e;
      }
      const error = e instanceof Error ? e : new Error(String(e));
      throw new PdfEngineException(
        `Could not read image ${i + 1}: ${error.message}`,
        'CORRUPTED_FILE',
        op,
        error
      );
    }

    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });

    onProgress?.({
      operationId: 'imagesToPdf',
      operation: op,
      percent: Math.round(((i + 1) / images.length) * 100),
      message: `Added image ${i + 1} of ${images.length}`,
    });
  }

  return doc.save();
}

/**
 * Stamps a diagonal text watermark (e.g. "COPY", "CONFIDENTIAL") across the
 * centre of every page (F-37). Semi-transparent grey so the underlying content
 * stays readable. pdf-lib only, offline.
 */
export async function watermarkPdfImpl(
  pdf: Uint8Array,
  text: string,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'watermarkPdf';
  const label = text.trim();
  if (!label) {
    throw new PdfEngineException('Watermark text is empty', 'UNSUPPORTED_FORMAT', op);
  }
  const doc = await loadAndValidatePdf(pdf, op);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    // Size the mark to the page so it spans the diagonal without overflowing.
    const size = Math.max(24, Math.min(width, height) / (label.length * 0.6 + 2));
    const textWidth = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: width / 2 - (textWidth / 2) * Math.SQRT1_2,
      y: height / 2 - (textWidth / 2) * Math.SQRT1_2,
      size,
      font,
      color: rgb(0.5, 0.5, 0.5),
      rotate: degrees(45),
      opacity: 0.25,
    });
    onProgress?.({
      operationId: 'watermark',
      operation: op,
      percent: Math.round(((i + 1) / pages.length) * 100),
      message: `Stamped page ${i + 1} of ${pages.length}`,
    });
  }

  return doc.save();
}
