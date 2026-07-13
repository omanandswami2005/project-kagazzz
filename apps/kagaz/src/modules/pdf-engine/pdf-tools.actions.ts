/**
 * pdf-engine (PDF Tools) Action Registry entries
 * (docs/design-system/agent-interface.md §Layer 2). Voice and AI tool calls
 * open the PDF Tools hub — optionally jumping straight to one operation —
 * through here. The actual run (pick documents → run → save) is a direct
 * manipulation on the screen.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { PdfOpId } from './services/pdf-ops-meta';

/** Capabilities the wired page provides to PDF Tools action handlers. */
export interface ToolsActionContext {
  /** Navigates to the PDF Tools hub, optionally opening one operation. */
  openPdfTools: (op?: PdfOpId) => void;
}

const opSchema = z.enum([
  'merge',
  'split',
  'organize',
  'compress',
  'pdfToImages',
  'pdfToText',
  'pdfToWord',
  'pdfToExcel',
  'imagesToPdf',
  'watermark',
  'stamp',
  'pageNumbers',
  'encrypt',
  'decrypt',
  'fillForm',
  'metadata',
]);

/** All PDF Tools actions, registered by id. */
export const toolsActions = {
  openPdfTools: defineAction({
    id: 'tools.openPdfTools',
    summary:
      'Open the PDF Tools hub to merge, split, compress, convert PDFs and images, watermark a PDF, password-protect/unlock a PDF, or fill a PDF form.',
    voice: [
      'open pdf tools',
      'merge pdfs',
      'split a pdf',
      'organize pdf pages',
      'reorder pdf pages',
      'rotate pdf pages',
      'delete pdf pages',
      'compress a pdf',
      'convert pdf to images',
      'extract text from a pdf',
      'convert pdf to text',
      'convert pdf to word',
      'pdf to docx',
      'convert pdf to excel',
      'pdf to spreadsheet',
      'watermark a pdf',
      'add a signature to a pdf',
      'stamp an image on a pdf',
      'add page numbers',
      'number the pages',
      'edit pdf details',
      'change pdf title',
      'password protect a pdf',
      'unlock a pdf',
      'fill a pdf form',
      'पीडीएफ़ उपकरण खोलो',
      'पीडीएफ़ मिलाओ',
    ],
    args: z.object({ op: opSchema.optional() }),
    requiresConfirmation: false,
    handler: (
      args: { op?: PdfOpId },
      ctx: ToolsActionContext
    ): Promise<{ opened: true }> => {
      ctx.openPdfTools(args.op);
      return Promise.resolve({ opened: true });
    },
  }),
};
