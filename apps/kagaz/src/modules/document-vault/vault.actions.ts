/**
 * document-vault Action Registry entries
 * (docs/design-system/agent-interface.md §Layer 2). Voice, AI tool
 * calls, and E2E tests invoke uploads through here — never through
 * component internals.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { UploadSource } from './services/upload-sources';
import { useVaultStore } from './store/vault.store';
import { SORT_KEYS } from './services/sort.service';

/**
 * What the page provides when invoking vault actions: the wired upload
 * flow (hooks own the service construction).
 */
export interface VaultActionContext {
  /** Opens the source picker sheet (no source given). */
  openUploadSheet: () => void;
  /** Starts the upload flow from a specific source. */
  uploadFrom: (source: UploadSource) => Promise<{ uploaded: number }>;
  /** Toggles a document's favorite flag by id (F-33). */
  toggleFavorite: (documentId: string) => Promise<{ isFavorite: boolean }>;
  /** Opens the tag selector for a document (F-10). */
  manageTags: (documentId: string) => void;
  /** Creates a tag (if new) and assigns it to a document (F-10). */
  tagDocument: (
    documentId: string,
    tagName: string
  ) => Promise<{ tagId: string }>;
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

  setSortBy: defineAction({
    id: 'vault.setSortBy',
    summary: 'Change how the document list is sorted.',
    voice: [
      'sort by name',
      'sort by date',
      'sort by size',
      'नाम से क्रमबद्ध करो',
      'आकार से क्रमबद्ध करो',
    ],
    args: z.object({ key: z.enum(SORT_KEYS) }),
    requiresConfirmation: false,
    handler: (args: {
      key: (typeof SORT_KEYS)[number];
    }): Promise<{ key: string }> => {
      useVaultStore.getState().setSortBy(args.key);
      return Promise.resolve({ key: args.key });
    },
  }),

  toggleFavorite: defineAction({
    id: 'vault.toggleFavorite',
    summary: "Mark or unmark a document as a favorite.",
    voice: [
      'favorite this',
      'add to favorites',
      'remove from favorites',
      'इसे पसंदीदा बनाओ',
    ],
    args: z.object({ documentId: z.string().min(1) }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string },
      ctx: VaultActionContext
    ): Promise<{ isFavorite: boolean }> => ctx.toggleFavorite(args.documentId),
  }),

  manageTags: defineAction({
    id: 'vault.manageTags',
    summary: 'Open the tag editor for a document.',
    voice: ['edit tags', 'manage tags', 'टैग संपादित करो'],
    args: z.object({ documentId: z.string().min(1) }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string },
      ctx: VaultActionContext
    ): Promise<{ ok: true }> => {
      ctx.manageTags(args.documentId);
      return Promise.resolve({ ok: true });
    },
  }),

  tagDocument: defineAction({
    id: 'vault.tagDocument',
    summary: 'Tag a document with a label, creating the tag if it is new.',
    voice: [
      'tag this as important',
      'add the tag personal',
      'इसे टैग करो',
    ],
    args: z.object({
      documentId: z.string().min(1),
      tag: z.string().min(1),
    }),
    requiresConfirmation: false,
    handler: (
      args: { documentId: string; tag: string },
      ctx: VaultActionContext
    ): Promise<{ tagId: string }> => ctx.tagDocument(args.documentId, args.tag),
  }),

  toggleSortDirection: defineAction({
    id: 'vault.toggleSortDirection',
    summary: 'Flip the document sort between ascending and descending.',
    voice: ['reverse the order', 'ascending', 'descending', 'उल्टा क्रम'],
    args: z.object({}),
    requiresConfirmation: false,
    handler: (): Promise<{ direction: string }> => {
      useVaultStore.getState().toggleSortDirection();
      return Promise.resolve({ direction: useVaultStore.getState().sortDirection });
    },
  }),
};
