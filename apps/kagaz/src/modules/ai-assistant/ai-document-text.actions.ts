/**
 * `ai.findInDocuments` and `ai.readDocumentText` — let the assistant look INSIDE
 * documents using the text extracted at upload, with no embedding model needed.
 * See services/document-text.service.ts.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { DocumentText, TextMatch } from './services/document-text.service';
import type { AiToolContext } from './ai-tools.actions';

export const aiDocumentTextActions = {
  findInDocuments: defineAction({
    id: 'ai.findInDocuments',
    summary:
      'Find documents whose TEXT contains a word or name (for example "rover" or a person\'s name) and get a snippet around each hit. Use a short distinctive keyword, not a whole sentence. Then call ai.readDocumentText on the best match to read the full text and answer (a mobile number, date, amount).',
    args: z.object({
      query: z.string().min(2).max(120),
      limit: z.number().int().min(1).max(8).default(5),
    }),
    requiresConfirmation: false,
    handler: (
      args: { query: string; limit: number },
      ctx: AiToolContext
    ): Promise<{ matches: TextMatch[] }> =>
      ctx.findInDocuments(args.query, args.limit).then((matches) => ({ matches })),
  }),

  readDocumentText: defineAction({
    id: 'ai.readDocumentText',
    summary:
      'Read the extracted text of one document (images and scanned PDFs are read first if needed) so you can answer questions about what it says. Answer only from this text and name the document; if the answer is not in it, say so.',
    args: z.object({ documentId: z.string().min(1) }),
    requiresConfirmation: false,
    handler: (args: { documentId: string }, ctx: AiToolContext): Promise<DocumentText> =>
      ctx.readDocumentText(args.documentId),
  }),
};
