/**
 * Migration 006 — quick_reference_entries.is_secure (UX pass, 2026-07-23,
 * user-requested: a second, faster-access "board" for insensitive data
 * that skips Quick Reference's biometric gate entirely). Migration 005 is
 * immutable once shipped (its own doc comment says so) — this is a new
 * migration, not an edit to it.
 *
 * Defaults existing rows to 1 (secure): every entry created before this
 * migration was created *behind* the biometric gate, so preserving that on
 * upgrade is the only non-surprising choice — an existing user's saved
 * Aadhaar/PAN/bank entries must not silently become gate-free.
 */
import type { Migration } from '../migration-runner';

const ADD_COLUMN_DDL = `
ALTER TABLE quick_reference_entries ADD COLUMN is_secure INTEGER NOT NULL DEFAULT 1;`;

/** F-84 follow-up: quick_reference_entries.is_secure (default 1/secure). */
export const addQuickReferenceSecurityFlag: Migration = {
  version: 6,
  name: 'add-quick-reference-security-flag',
  up: async (db) => {
    await db.execute(ADD_COLUMN_DDL);
  },
  down: async () => {
    // SQLite has no DROP COLUMN before 3.35 and the app's target runtime
    // isn't guaranteed to have it — down is a documented no-op, same
    // posture as any other additive column migration in this codebase
    // would need (there is no precedent yet, this is the first one).
  },
};
