/**
 * Quick Notes Action Registry entries (UX pass, 2026-07-23,
 * docs/design-system/agent-interface.md §Layer 2). Mirrors
 * quick-reference.actions.ts exactly — copy/create are agent-actionable,
 * delete is not (same irreversible/no-undo posture as Quick Reference's own
 * delete and Trash's delete-forever). Quick Notes has no unlock action to
 * exclude in the first place (that's the whole point of this board), so
 * unlike Quick Reference there's nothing else withheld here.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';

/** What the page provides when invoking Quick Notes actions. */
export interface QuickNotesActionContext {
  /** Copies a note's raw value to the clipboard. */
  copyValue: (entryId: string) => Promise<boolean>;
  /** Copies a note as "<label>: <value>". */
  copyWithLabel: (entryId: string) => Promise<boolean>;
  /** Creates a note, returns its id. */
  createEntry: (label: string, value: string) => Promise<{ entryId: string | null }>;
}

/** All Quick Notes actions, registered by id. */
export const quickNotesActions = {
  copyValue: defineAction({
    id: 'quicknotes.copyValue',
    summary: "Copy a Quick Notes entry's value to the clipboard.",
    voice: ['copy this note', 'copy my wifi password'],
    args: z.object({ entryId: z.string().min(1) }),
    requiresConfirmation: false,
    handler: (
      args: { entryId: string },
      ctx: QuickNotesActionContext
    ): Promise<boolean> => ctx.copyValue(args.entryId),
  }),

  copyWithLabel: defineAction({
    id: 'quicknotes.copyWithLabel',
    summary: 'Copy a Quick Notes entry as "label: value" to the clipboard.',
    voice: ['copy this note with its title'],
    args: z.object({ entryId: z.string().min(1) }),
    requiresConfirmation: false,
    handler: (
      args: { entryId: string },
      ctx: QuickNotesActionContext
    ): Promise<boolean> => ctx.copyWithLabel(args.entryId),
  }),

  createEntry: defineAction({
    id: 'quicknotes.createEntry',
    summary: 'Save a new quick note.',
    voice: ['save a quick note', 'add a note titled wifi password'],
    args: z.object({
      label: z.string().min(1),
      value: z.string().min(1),
    }),
    requiresConfirmation: false,
    handler: (
      args: { label: string; value: string },
      ctx: QuickNotesActionContext
    ): Promise<{ entryId: string | null }> => ctx.createEntry(args.label, args.value),
  }),
} as const;
