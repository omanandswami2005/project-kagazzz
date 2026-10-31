/**
 * AI-callable image tools: resize+compress for forms (F-85), enhance
 * filters (F-29) and OCR indexing (F-20). Each runs the same document-vault
 * hook the UI uses, so behaviour (and any lock gate) is identical to the
 * human path — see `useChat`'s tool context for the wiring.
 *
 * `requiresConfirmation: false` for all three, same reasoning as
 * ai-document-ops.actions.ts: resize and enhance save a NEW document and
 * never touch the source, and OCR only fills the document's own search
 * text. [SEC] `ai.runOcr` returns a character count, never the text — the
 * metadata-only boundary (10-security-architecture.md §5) still holds.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { AiToolContext } from './ai-tools.actions';

/** Mirrors `FILTER_PRESETS` in image-engine/services/image-filters.ts. */
const filterPresetSchema = z.enum(['grayscale', 'bw', 'enhance', 'invert']);

export type AiFilterPreset = z.infer<typeof filterPresetSchema>;

export interface ResizeImageResult {
  created: number;
  resultSizeBytes: number;
  /** True when even the lowest quality exceeded the size budget. */
  hitQualityFloor: boolean;
}

export const aiImageOpsActions = {
  resizeImage: defineAction({
    id: 'ai.resizeImage',
    summary:
      'Resize an image to exact pixel dimensions and compress it under a size limit (e.g. a 200x230 photo under 50 KB for a government form), saving a new copy. The original is untouched.',
    voice: ['resize this photo', 'make this image smaller for the form', 'इस फ़ोटो का साइज़ बदलो'],
    args: z.object({
      documentId: z.string(),
      width: z.number().int().min(16).max(8000),
      height: z.number().int().min(16).max(8000),
      maxSizeKb: z.number().int().min(5).max(20_000),
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string; width: number; height: number; maxSizeKb: number },
      ctx: AiToolContext
    ): Promise<ResizeImageResult> =>
      ctx.resizeImage(args.documentId, args.width, args.height, args.maxSizeKb * 1024),
  }),

  enhanceImage: defineAction({
    id: 'ai.enhanceImage',
    summary:
      'Apply a filter to an image document — grayscale, bw (black & white scan look), enhance (auto contrast) or invert — saving a new copy. The original is untouched.',
    voice: ['enhance this photo', 'make this black and white', 'इस फ़ोटो को बेहतर करो'],
    args: z.object({
      documentId: z.string(),
      preset: filterPresetSchema,
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string; preset: AiFilterPreset },
      ctx: AiToolContext
    ): Promise<{ created: number }> =>
      ctx.enhanceImage(args.documentId, args.preset).then((created) => ({ created })),
  }),

  runOcr: defineAction({
    id: 'ai.runOcr',
    summary:
      'Read the text in an image or scanned PDF and store it so the document becomes searchable. Returns only how many characters were found — never the text itself.',
    voice: ['read the text in this document', 'make this searchable', 'इस डॉक्यूमेंट का टेक्स्ट पढ़ो'],
    args: z.object({
      documentId: z.string(),
    }),
    requiresConfirmation: false,
    handler: (args: { documentId: string }, ctx: AiToolContext): Promise<{ characters: number }> =>
      ctx.runOcr(args.documentId).then((characters) => ({ characters })),
  }),
};
