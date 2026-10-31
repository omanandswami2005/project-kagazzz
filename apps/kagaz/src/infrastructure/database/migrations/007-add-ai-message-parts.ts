/**
 * Migration 007 — structured chat message parts (chat journey, 2026-10-31).
 * `ai_messages.parts_json` holds what plain `content` cannot: documents the
 * user attached, result cards for documents a tool created, assistant forms
 * (GenUI) and the answers to them. Nullable and additive: every existing row
 * stays a plain text message. Migrations 001–006 are immutable once shipped.
 *
 * `ai_conversations.active_skills` remembers which tool groups (skills) were
 * loaded so a reopened conversation does not start from core tools again.
 *
 * [SEC] Parts hold document ids/names and the user's form answers — chat
 * content, so encrypted-DB only and never logged (10-security §5).
 */
import type { Migration } from '../migration-runner';

const DDL = `
ALTER TABLE ai_messages ADD COLUMN parts_json TEXT;
ALTER TABLE ai_conversations ADD COLUMN active_skills TEXT;`;

export const addAiMessageParts: Migration = {
  version: 7,
  name: 'add-ai-message-parts',
  up: async (db) => {
    await db.execute(DDL);
  },
  down: async () => {
    // Additive columns; SQLite < 3.35 has no DROP COLUMN, so down is a documented no-op
    // (same posture as migration 006).
  },
};
