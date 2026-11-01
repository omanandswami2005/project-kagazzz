/**
 * `ai.semanticSearch` — find documents by meaning and read the matching
 * passages, so the assistant can answer questions about what documents SAY.
 * See services/document-search.service.ts for the pipeline and the (demo-only)
 * relaxation of the metadata-only rule.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { SemanticSearchResult } from './services/document-search.service';
import type { AiToolContext } from './ai-tools.actions';

export const aiSemanticSearchActions = {
  semanticSearch: defineAction({
    id: 'ai.semanticSearch',
    summary:
      'Search inside the user\'s documents BY MEANING and get back the best matching passages with their document names, so you can answer questions about what documents say (amounts, dates, names, clauses). Images and scanned PDFs are read first, so the first call can take a moment. Answer ONLY from the returned passages, name the source document, and if the passages do not contain the answer say so — never guess.',
    args: z.object({
      query: z.string().min(2).max(300),
      limit: z.number().int().min(1).max(8).default(4),
    }),
    requiresConfirmation: false,
    handler: (args: { query: string; limit: number }, ctx: AiToolContext): Promise<SemanticSearchResult> =>
      ctx.semanticSearch(args.query, args.limit),
  }),
};
