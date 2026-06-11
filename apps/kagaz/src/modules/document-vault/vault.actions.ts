/**
 * document-vault Action Registry entries
 * (docs/design-system/agent-interface.md §Layer 2). Voice, AI tool
 * calls, and E2E tests invoke uploads through here — never through
 * component internals.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { UploadSource } from './services/upload-sources';

/**
 * What the page provides when invoking vault actions: the wired upload
 * flow (hooks own the service construction).
 */
export interface VaultActionContext {
  /** Opens the source picker sheet (no source given). */
  openUploadSheet: () => void;
  /** Starts the upload flow from a specific source. */
  uploadFrom: (source: UploadSource) => Promise<{ uploaded: number }>;
}

const uploadSourceSchema = z.enum(['camera', 'gallery', 'files']);

/** All document-vault actions, registered by id. */
export const vaultActions = {
  uploadDocument: defineAction({
    id: 'vault.uploadDocument',
    summary:
      'Add a document to the vault from the camera, the photo gallery, or the file picker.',
    voice: [
      'upload a document',
      'add a file',
      'दस्तावेज़ अपलोड करो',
      'फोटो जोड़ो',
    ],
    args: z.object({
      source: uploadSourceSchema.optional(),
    }),
    // Upload is additive and reversible (delete) — no confirmation card.
    requiresConfirmation: false,
    handler: async (
      args: { source?: UploadSource },
      ctx: VaultActionContext
    ): Promise<{ uploaded: number }> => {
      if (!args.source) {
        ctx.openUploadSheet();
        return { uploaded: 0 };
      }
      return ctx.uploadFrom(args.source);
    },
  }),
};
