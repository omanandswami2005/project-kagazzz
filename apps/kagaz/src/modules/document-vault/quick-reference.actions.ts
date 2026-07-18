/**
 * Quick Reference Action Registry entries (F-84,
 * docs/design-system/agent-interface.md §Layer 2). Copy and create are
 * agent-actionable (same posture as F-68's Copy text — user-initiated,
 * non-destructive, never logged). Delete has **no** Action Registry entry —
 * unlike a document's soft-delete-to-Trash, a Quick Reference entry has no
 * undo, so this follows Trash's own delete-forever/empty-trash precedent:
 * irreversible + no undo = user-only, never agent-callable. The biometric
 * unlock itself is likewise never in the registry (see QuickReferencePage)
 * so an AI tool call can never bypass the screen's lock — matching F-16.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';

/** What the page provides when invoking Quick Reference actions. */
export interface QuickReferenceActionContext {
  /** Copies an entry's raw value to the clipboard. */
  copyValue: (entryId: string) => Promise<boolean>;
  /** Copies an entry as "<label>: <value>". */
  copyWithLabel: (entryId: string) => Promise<boolean>;
  /** Creates an entry, returns its id. */
  createEntry: (label: string, value: string) => Promise<{ entryId: string | null }>;
}

/** All Quick Reference actions, registered by id. */
export const quickReferenceActions = {
  copyValue: defineAction({
    id: 'quickref.copyValue',
    summary: "Copy a Quick Reference entry's value to the clipboard.",
    voice: ['copy my PAN number', 'copy this value', 'इसे कॉपी करो'],
    args: z.object({ entryId: z.string().min(1) }),
    requiresConfirmation: false,
    handler: (
      args: { entryId: string },
      ctx: QuickReferenceActionContext
    ): Promise<boolean> => ctx.copyValue(args.entryId),
  }),

  copyWithLabel: defineAction({
    id: 'quickref.copyWithLabel',
    summary: 'Copy a Quick Reference entry as "label: value" to the clipboard.',
    voice: ['copy this with its label'],
    args: z.object({ entryId: z.string().min(1) }),
    requiresConfirmation: false,
    handler: (
      args: { entryId: string },
      ctx: QuickReferenceActionContext
    ): Promise<boolean> => ctx.copyWithLabel(args.entryId),
  }),

  createEntry: defineAction({
    id: 'quickref.createEntry',
    summary: 'Save a new labelled value to Quick Reference.',
    voice: ['save my PAN number as ABCDE1234F', 'add a quick reference'],
    args: z.object({
      label: z.string().min(1),
      value: z.string().min(1),
    }),
    requiresConfirmation: false,
    handler: (
      args: { label: string; value: string },
      ctx: QuickReferenceActionContext
    ): Promise<{ entryId: string | null }> => ctx.createEntry(args.label, args.value),
  }),
} as const;

