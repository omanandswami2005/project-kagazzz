/**
 * AI-callable document-operation tools (F-14, 05-ai-assistant-module.md
 * §4.2.1/§4.2.3). Merge, split, compress, watermark, and convert a
 * document via the same pdf-engine ops PDF Tools already runs
 * (`usePdfEngine`, `apps/kagaz/src/modules/pdf-engine/hooks/usePdfEngine.ts`)
 * — real file operations, not stubs.
 *
 * `requiresConfirmation: false` for all seven — see
 * `docs/architecture/10-security-architecture.md` §5.3 (reclassified
 * 2026-07-25): every one of these operations creates a brand-new vault
 * document and never mutates or deletes the source, so per the actual
 * `requiresConfirmation` policy ("true ONLY for actions without undo"),
 * none of them need a confirmation card — undo is just deleting the new
 * document. Deliberately excluded from this pass: encrypt/decrypt
 * (password handling through the model's context is a separate risk,
 * independent of "destructive") and any in-place-mutation tool.
 *
 * Page numbers in tool args are 1-indexed (natural for a human/model to
 * say "pages 1 to 3") — `pdf-engine.types.ts`'s `PageRange` is 0-indexed
 * internally, so `splitDocument`'s handler converts.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { AiToolContext } from './ai-tools.actions';

const qualitySchema = z.enum(['low', 'medium', 'high']);
const imageFormatSchema = z.enum(['jpeg', 'png']);
const textFormatSchema = z.enum(['txt', 'md']);

export const aiDocumentOpsActions = {
  mergeDocuments: defineAction({
    id: 'ai.mergeDocuments',
    summary:
      'Merge two or more existing documents (in the given order) into a single new PDF. The originals are untouched.',
    voice: ['merge these documents', 'combine these into one pdf', 'इन्हें एक PDF में मिलाओ'],
    args: z.object({
      documentIds: z.array(z.string()).min(2, 'Merging needs at least 2 documents'),
    }),
    requiresConfirmation: false,
    handler: (args: { documentIds: string[] }, ctx: AiToolContext): Promise<{ created: number }> =>
      ctx.mergeDocuments(args.documentIds).then((created) => ({ created })),
  }),

  splitDocument: defineAction({
    id: 'ai.splitDocument',
    summary:
      'Split a PDF into multiple new documents by page ranges (1-indexed, inclusive). The original is untouched.',
    voice: ['split this pdf', 'split this document into pages', 'इस PDF को बांटो'],
    args: z.object({
      documentId: z.string(),
      ranges: z
        .array(
          z.object({
            start: z.number().int().min(1),
            end: z.number().int().min(1),
          })
        )
        .min(1, 'Splitting needs at least one page range'),
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string; ranges: { start: number; end: number }[] },
      ctx: AiToolContext
    ): Promise<{ created: number }> =>
      ctx.splitDocument(args.documentId, args.ranges).then((created) => ({ created })),
  }),

  compressDocument: defineAction({
    id: 'ai.compressDocument',
    summary:
      'Reduce the file size of a PDF, creating a new compressed copy. The original is untouched.',
    voice: ['compress this pdf', 'shrink this document', 'इस PDF को छोटा करो'],
    args: z.object({
      documentId: z.string(),
      quality: qualitySchema.default('medium'),
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string; quality: 'low' | 'medium' | 'high' },
      ctx: AiToolContext
    ): Promise<{ created: number }> =>
      ctx.compressDocument(args.documentId, args.quality).then((created) => ({ created })),
  }),

  watermarkDocument: defineAction({
    id: 'ai.watermarkDocument',
    summary: 'Add a text watermark to every page of a PDF, creating a new watermarked copy.',
    voice: ['watermark this pdf', 'add a watermark', 'इस PDF पर वॉटरमार्क लगाओ'],
    args: z.object({
      documentId: z.string(),
      text: z.string().min(1),
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string; text: string },
      ctx: AiToolContext
    ): Promise<{ created: number }> =>
      ctx.watermarkDocument(args.documentId, args.text).then((created) => ({ created })),
  }),

  convertImagesToPdf: defineAction({
    id: 'ai.convertImagesToPdf',
    summary: 'Combine one or more existing image documents into a single new PDF.',
    voice: ['convert these images to pdf', 'combine these photos into a pdf', 'इन तस्वीरों को PDF बनाओ'],
    args: z.object({
      documentIds: z.array(z.string()).min(1),
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentIds: string[] },
      ctx: AiToolContext
    ): Promise<{ created: number }> =>
      ctx.convertImagesToPdf(args.documentIds).then((created) => ({ created })),
  }),

  convertPdfToImages: defineAction({
    id: 'ai.convertPdfToImages',
    summary: 'Render every page of a PDF to a separate new image document.',
    voice: ['convert this pdf to images', 'turn this pdf into pictures', 'इस PDF को तस्वीरों में बदलो'],
    args: z.object({
      documentId: z.string(),
      format: imageFormatSchema.default('jpeg'),
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string; format: 'jpeg' | 'png' },
      ctx: AiToolContext
    ): Promise<{ created: number }> =>
      ctx.convertPdfToImages(args.documentId, args.format).then((created) => ({ created })),
  }),

  exportPdfText: defineAction({
    id: 'ai.exportPdfText',
    summary:
      "Extract a PDF's text layer into a new plain-text or Markdown document. Fails if the PDF has no selectable text (e.g. a scan with no OCR yet) — the extracted text itself is never returned here, only the new document is created (metadata-only boundary, §5).",
    voice: ['export this pdf as text', 'convert this pdf to a text file', 'इस PDF को टेक्स्ट में बदलो'],
    args: z.object({
      documentId: z.string(),
      format: textFormatSchema.default('txt'),
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string; format: 'txt' | 'md' },
      ctx: AiToolContext
    ): Promise<{ created: number }> =>
      ctx.exportPdfText(args.documentId, args.format).then((created) => ({ created })),
  }),
};
