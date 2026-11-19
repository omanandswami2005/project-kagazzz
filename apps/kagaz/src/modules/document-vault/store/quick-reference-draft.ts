/**
 * One-shot hand-off of a value into the Quick Reference "Add" sheet, from a
 * screen that found it (a Quick Note, the viewer's number chips) — audit
 * QN-2, VW-9. Held in memory only, never persisted or put in the URL, and
 * taken (cleared) by the first reader.
 */
import type { IdKind } from '@/core/id-numbers';

/** A value waiting to be added to Quick Reference. */
export interface QuickReferenceDraft {
  label: string;
  value: string;
  /** Set when the value is a recognised ID (drives Aadhaar masking). */
  kind?: IdKind;
  /** Runs after the entry is saved — e.g. remove the Quick Note it came from. */
  onSaved?: () => Promise<void> | void;
}

let pending: QuickReferenceDraft | null = null;

/** Queues a draft for the next Quick Reference visit. */
export function offerQuickReferenceDraft(draft: QuickReferenceDraft): void {
  pending = draft;
}

/** Returns and clears the queued draft, if any. */
export function takeQuickReferenceDraft(): QuickReferenceDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}
