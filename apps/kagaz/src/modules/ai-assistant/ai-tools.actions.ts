/**
 * AI-callable tool actions (F-14, 05-ai-assistant-module.md §4). Uses the
 * same Action Registry every voice command and E2E test already goes
 * through (`@kagaz/agent-kit`'s `defineAction`/`ActionRegistry` — see
 * vault.actions.ts for the established pattern) — not a separate
 * hand-rolled tool-calling system. `ActionRegistry.toToolDefinitions()`
 * already turns each action's Zod schema into the OpenAI/JSON-schema tool
 * description the native bridge needs (see ai-engine.service.ts's
 * `toToolDescriptors()`).
 *
 * Deliberately a small, curated starting set — NOT vault.actions.ts's
 * existing actions. Those need a `VaultActionContext` built from
 * VaultHomePage-local UI state (open sheets, filter panel, tag selector)
 * that a separate ChatPage screen can't construct; wiring those in is a
 * real follow-up, not attempted here. Both actions below are read-only
 * and metadata-only (`[SEC]` §11 — never document content/OCR text),
 * so `requiresConfirmation: false` for both.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { DocumentEntity } from '@/infrastructure/database/types';

/** Metadata-only projection of a document — never `ocrText`/`filePath`. */
export interface DocumentSummary {
  id: string;
  name: string;
  fileType: string;
  fileSizeBytes: number;
  isFavorite: boolean;
  isLocked: boolean;
  createdAt: string;
}

/** Strips a full DocumentEntity down to what's safe to hand the model. */
export function toDocumentSummary(doc: DocumentEntity): DocumentSummary {
  return {
    id: doc.id,
    name: doc.name,
    fileType: doc.fileType,
    fileSizeBytes: doc.fileSize,
    isFavorite: doc.isFavorite,
    isLocked: doc.isLocked,
    createdAt: doc.createdAt,
  };
}

/** What the AI tool handlers below need — built from a DocumentDao in useChat. */
export interface AiToolContext {
  listDocuments: (limit: number) => Promise<DocumentSummary[]>;
  searchDocuments: (query: string, limit: number) => Promise<DocumentSummary[]>;
}

export const aiToolActions = {
  listDocuments: defineAction({
    id: 'ai.listDocuments',
    summary:
      'List the user\'s most recently added documents (metadata only: name, type, size, favorite/lock status — never document content).',
    args: z.object({
      limit: z.number().int().min(1).max(50).default(20),
    }),
    requiresConfirmation: false,
    handler: (args: { limit: number }, ctx: AiToolContext): Promise<{ documents: DocumentSummary[] }> =>
      ctx.listDocuments(args.limit).then((documents) => ({ documents })),
  }),

  searchDocuments: defineAction({
    id: 'ai.searchDocuments',
    summary:
      'Search the user\'s documents by name or extracted text, returning metadata only (never the matched text itself).',
    args: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    requiresConfirmation: false,
    handler: (
      args: { query: string; limit: number },
      ctx: AiToolContext
    ): Promise<{ documents: DocumentSummary[] }> =>
      ctx.searchDocuments(args.query, args.limit).then((documents) => ({ documents })),
  }),
};
