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
  'compress',
  'pdfToImages',
  'imagesToPdf',
  'watermark',
  'encrypt',
  'decrypt',
  'fillForm',
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
      'compress a pdf',
      'convert pdf to images',
      'watermark a pdf',
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
