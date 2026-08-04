import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { isEncrypted } from '@pdfsmaller/pdf-decrypt';
import {
  type ImageInput,
  type PageNumberOptions,
  type PageNumberPosition,
  type PageRange,
  type ProgressCallback,
  type StampOptions,
  type StampPosition,
  PdfEngineException,
} from '../types/pdf-engine.types';

/**
 * Validates a Uint8Array as a PDF and loads it.
 *
 * Bug-audit fix: a password-protected input used to fall straight into
 * `PDFDocument.load`'s catch block and come out as a generic `INVALID_PDF`
 * ("this isn't a valid PDF") for every op that isn't decrypt — merge, split,
 * organize, watermark, compress, etc. — which is actively misleading: the
 * file is a perfectly valid PDF, it's just locked, and the message gave the
 * user no way to know they needed to decrypt it first. Pre-checking here
 * fixes every op that funnels through this shared helper at once.
 */
export async function loadAndValidatePdf(pdf: Uint8Array, operation: string): Promise<PDFDocument> {
  if (!pdf || pdf.length === 0) {
    throw new PdfEngineException('Empty or missing PDF data', 'INVALID_PDF', operation);
  }
  try {
    if ((await isEncrypted(pdf)).encrypted) {
      throw new PdfEngineException(
        'This PDF is password-protected — unlock it first',
        'PASSWORD_REQUIRED',
        operation
      );
    }
  } catch (e: unknown) {
    if (e instanceof PdfEngineException) {
      throw e;
    }
    // isEncrypted() itself couldn't read the header — fall through to the
    // normal load attempt below, which will classify it as INVALID_PDF.
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

/** Margin (pt) from the page edge for a stamped image (F-38). */
const STAMP_MARGIN = 24;

/**
 * Computes the bottom-left (x, y) for a stamped image box of the given size,
 * positioned within the page with a margin (F-38). pdf-lib's origin is the
 * bottom-left corner.
 */
function stampXY(
  position: StampPosition,
  pageWidth: number,
  pageHeight: number,
  boxWidth: number,
  boxHeight: number
): { x: number; y: number } {
  const [vertical, horizontal] = position.split('-');
  let x: number;
  if (horizontal === 'left') {
    x = STAMP_MARGIN;
  } else if (horizontal === 'right') {
    x = pageWidth - STAMP_MARGIN - boxWidth;
  } else {
    x = (pageWidth - boxWidth) / 2;
  }
  let y: number;
  // 'center' has no dash → vertical === 'center', horizontal === undefined.
  if (vertical === 'top') {
    y = pageHeight - STAMP_MARGIN - boxHeight;
  } else if (vertical === 'center') {
    y = (pageHeight - boxHeight) / 2;
    x = (pageWidth - boxWidth) / 2;
  } else {
    y = STAMP_MARGIN;
  }
  return { x, y };
}

/**
 * Stamps an image (a signature or photo) onto one page of a PDF (F-38). The
 * image is scaled to `widthPercent` of the page width and placed in the chosen
 * corner/edge. Only JPEG and PNG embed in pdf-lib. pdf-lib only, offline.
 */
export async function stampImageImpl(
  pdf: Uint8Array,
  image: ImageInput,
  options: StampOptions,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'stampImage';
  const doc = await loadAndValidatePdf(pdf, op);
  const pageCount = doc.getPageCount();
  if (options.page < 0 || options.page >= pageCount) {
    throw new PdfEngineException(
      `Page ${options.page + 1} is out of range (1–${pageCount})`,
      'PAGE_OUT_OF_RANGE',
      op
    );
  }

  const type = image.mimeType.toLowerCase();
  let embedded;
  try {
    if (JPEG_TYPES.has(type)) {
      embedded = await doc.embedJpg(image.data);
    } else if (type === 'image/png') {
      embedded = await doc.embedPng(image.data);
    } else {
      throw new PdfEngineException(
        `Unsupported stamp image "${image.mimeType}" — use JPEG or PNG`,
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
      `Could not read the stamp image: ${error.message}`,
      'CORRUPTED_FILE',
      op,
      error
    );
  }

  onProgress?.({
    operationId: 'stampImage',
    operation: op,
    percent: 50,
    message: 'Placing image…',
  });

  const page = doc.getPage(options.page);
  const { width, height } = page.getSize();
  const widthPercent = Math.min(100, Math.max(1, options.widthPercent ?? 25));
  const boxWidth = (width * widthPercent) / 100;
  const boxHeight = (embedded.height / embedded.width) * boxWidth;
  const { x, y } = stampXY(
    options.position ?? 'bottom-right',
    width,
    height,
    boxWidth,
    boxHeight
  );
  page.drawImage(embedded, { x, y, width: boxWidth, height: boxHeight });

  const result = await doc.save();
  onProgress?.({
    operationId: 'stampImage',
    operation: op,
    percent: 100,
    message: 'Done',
  });
  return result;
}

/** Margin (pt) from the page edge for stamped page numbers (F-36). */
const PAGE_NUMBER_MARGIN = 28;

/** Builds the label for one page given the chosen format (F-36). */
function formatPageNumber(
  format: NonNullable<PageNumberOptions['format']>,
  n: number,
  total: number
): string {
  switch (format) {
    case 'page-n':
      return `Page ${n}`;
    case 'n-of-total':
      return `${n} / ${total}`;
    default:
      return String(n);
  }
}

/**
 * Computes the (x, y) baseline for a page number given its position, the page
 * size, and the rendered label width/height (F-36). pdf-lib's origin is the
 * bottom-left corner.
 */
function pageNumberXY(
  position: PageNumberPosition,
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number
): { x: number; y: number } {
  const [vertical, horizontal] = position.split('-');
  const y =
    vertical === 'top' ? pageHeight - PAGE_NUMBER_MARGIN - fontSize : PAGE_NUMBER_MARGIN;
  let x: number;
  if (horizontal === 'left') {
    x = PAGE_NUMBER_MARGIN;
  } else if (horizontal === 'right') {
    x = pageWidth - PAGE_NUMBER_MARGIN - textWidth;
  } else {
    x = pageWidth / 2 - textWidth / 2;
  }
  return { x, y };
}

/**
 * Stamps sequential page numbers onto every page (F-36). Position, text format,
 * and starting number are configurable; the number is drawn in a small dark-grey
 * Helvetica so it reads without dominating the page. pdf-lib only, offline.
 */
export async function addPageNumbersImpl(
  pdf: Uint8Array,
  options: PageNumberOptions,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'addPageNumbers';
  const position = options.position ?? 'bottom-center';
  const format = options.format ?? 'plain';
  const startAt = Number.isFinite(options.startAt) ? Math.trunc(options.startAt as number) : 1;

  const doc = await loadAndValidatePdf(pdf, op);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const fontSize = 11;

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const label = formatPageNumber(format, startAt + i, startAt + total - 1);
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const { x, y } = pageNumberXY(position, width, height, textWidth, fontSize);
    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    onProgress?.({
      operationId: 'addPageNumbers',
      operation: op,
      percent: Math.round(((i + 1) / total) * 100),
      message: `Numbered page ${i + 1} of ${total}`,
    });
  }

  return doc.save();
}
