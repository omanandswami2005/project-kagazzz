/**
 * Page organisation (F-35): reorder, rotate, and delete pages via pdf-lib.
 * The caller supplies the final page list ({@link PageOp}[]); this builds a new
 * document from the referenced source pages in order, applying each page's
 * extra rotation on top of its existing one. pdf-lib only, offline, no canvas.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import { loadAndValidatePdf } from './pdf-ops';
import { type PageOp, type ProgressCallback, PdfEngineException } from '../types/pdf-engine.types';

/**
 * Produces a new PDF from `ops`: each entry copies one source page (in order)
 * and adds its clockwise rotation. An empty list, an out-of-range index, or a
 * non-multiple-of-90 rotation is rejected.
 */
export async function organizePagesImpl(
  pdf: Uint8Array,
  ops: PageOp[],
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'organizePages';
  if (!ops || ops.length === 0) {
    throw new PdfEngineException(
      'The document must keep at least one page',
      'UNSUPPORTED_FORMAT',
      op
    );
  }

  const source = await loadAndValidatePdf(pdf, op);
  const pageCount = source.getPageCount();
  for (const { sourceIndex, rotation } of ops) {
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= pageCount) {
      throw new PdfEngineException(
        `Page index ${sourceIndex} is out of range (0–${pageCount - 1})`,
        'PAGE_OUT_OF_RANGE',
        op
      );
    }
    if (rotation % 90 !== 0) {
      throw new PdfEngineException(
        `Rotation must be a multiple of 90 (got ${rotation})`,
        'UNSUPPORTED_FORMAT',
        op
      );
    }
  }

  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    source,
    ops.map((o) => o.sourceIndex)
  );
  for (let i = 0; i < copied.length; i++) {
    const page = copied[i];
    const existing = page.getRotation().angle;
    page.setRotation(degrees((existing + ops[i].rotation) % 360));
    out.addPage(page);
    onProgress?.({
      operationId: 'organizePages',
      operation: op,
      percent: Math.round(((i + 1) / copied.length) * 100),
      message: `Arranged page ${i + 1} of ${copied.length}`,
    });
  }

  return out.save();
}
