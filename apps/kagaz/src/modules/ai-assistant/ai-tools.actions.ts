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
import type { SemanticSearchResult } from './services/document-search.service';
import type { AskUserSpec } from './types/ask-user';
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

/** Documents a tool created: ids let the chat link to them and the model chain steps ("merge, then compress the merged one"). */
export interface CreatedDocuments {
  created: number;
  documents: DocumentSummary[];
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

/**
 * What the AI tool handlers below need — built from a DocumentDao (+
 * usePdfEngine for the document-op tools) in useChat, plus (F-23) the
 * router-backed navigation methods ai-navigation.actions.ts's handlers
 * call. Kept as one interface (rather than one per action file) since all
 * three are assembled into a single `toolContext` object in useChat.ts.
 */
export interface AiToolContext {
  listDocuments: (limit: number) => Promise<DocumentSummary[]>;
  searchDocuments: (query: string, limit: number) => Promise<DocumentSummary[]>;
  /** Navigates to Quick Reference (F-23). */
  openQuickReference: () => void;
  /** Navigates to Quick Notes (F-23). */
  openQuickNotes: () => void;
  /** Navigates to Quick Notes with the add-note composer already open (F-23). */
  startQuickNote: () => void;
  /** Navigates to Settings (F-23). */
  openSettings: () => void;
  /** Navigates to the PDF Tools hub (F-23). */
  openPdfTools: () => void;
  /** Merges the given documents (2+) into one new PDF (ai-document-ops.actions.ts). */
  mergeDocuments: (documentIds: string[]) => Promise<CreatedDocuments>;
  /** Splits a PDF by 1-indexed inclusive page ranges into new documents. */
  splitDocument: (documentId: string, ranges: { start: number; end: number }[]) => Promise<CreatedDocuments>;
  /** Compresses a PDF into a new, smaller copy. */
  compressDocument: (documentId: string, quality: 'low' | 'medium' | 'high') => Promise<CreatedDocuments>;
  /** Adds a text watermark, creating a new copy. */
  watermarkDocument: (documentId: string, text: string) => Promise<CreatedDocuments>;
  /** Combines image documents into one new PDF. */
  convertImagesToPdf: (documentIds: string[]) => Promise<CreatedDocuments>;
  /** Renders every PDF page to a new image document each. */
  convertPdfToImages: (documentId: string, format: 'jpeg' | 'png') => Promise<CreatedDocuments>;
  /** Extracts a PDF's text layer into a new text/Markdown document. */
  exportPdfText: (documentId: string, format: 'txt' | 'md') => Promise<CreatedDocuments>;
  /** Resizes+compresses an image to exact dimensions under a byte budget (ai-image-ops.actions.ts). */
  resizeImage: (
    documentId: string,
    width: number,
    height: number,
    maxSizeBytes: number
  ) => Promise<CreatedDocuments & { resultSizeBytes: number; hitQualityFloor: boolean }>;
  /** Applies an image filter preset, saving a new copy. */
  enhanceImage: (
    documentId: string,
    preset: 'grayscale' | 'bw' | 'enhance' | 'invert'
  ) => Promise<CreatedDocuments>;
  /** OCRs a document into its search text; resolves the character count only (never the text). */
  runOcr: (documentId: string) => Promise<number>;
  /** Searches inside documents by meaning and returns the matching passages (ai-semantic-search.actions.ts). */
  semanticSearch: (query: string, limit: number) => Promise<SemanticSearchResult>;
  /** Puts a form in front of the user and returns; the model's turn ends (ai-ask-user.actions.ts). */
  askUser: (spec: AskUserSpec) => { status: 'waiting_for_user' };
  /** Loads a skill's tools into the chat and returns its usage rules (ai-skills.actions.ts). */
  loadSkill: (name: string) => { loaded: string; tools: string[]; rules: string; next: string };
  /** Applies (and persists) the colour theme (ai-settings.actions.ts). */
  setTheme: (theme: 'system' | 'light' | 'dark') => void;
  /** Switches (and persists) the UI language (ai-settings.actions.ts). */
  setLanguage: (language: 'en' | 'hi') => void;
  /** Sets which action fires on swipe-left/right over document rows (F-88, ai-settings.actions.ts). */
  setSwipeAction: (
    side: 'left' | 'right',
    action: 'delete' | 'favorite' | 'move' | 'tags' | 'archive' | 'none'
  ) => void;
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
