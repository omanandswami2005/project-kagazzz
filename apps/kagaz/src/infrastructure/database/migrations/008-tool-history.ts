/**
 * Migration 008 — tool run history (PDF Tools history, 2026-11-19).
 *
 * Rebuilds `operations_history` for what the app actually records: one row per
 * tool run, keyed by the PDF Tools catalog id (`merge`, `stamp`, `pageNumbers`,
 * …). The 001 table's `CHECK (operation_type IN (10 values))` rejected most of
 * today's tools and allowed one output document, while split / PDF → images
 * create many. SQLite cannot alter a CHECK constraint, and the old table was
 * never written by any release, so it is dropped and recreated.
 *
 * [SEC] Rows hold document ids only — no names, no parameters, never
 * passwords (encrypt/decrypt, form values). Names are looked up live, so a
 * permanently deleted document leaves no name behind (DPDP minimisation).
 */
import type { Migration } from '../migration-runner';

const DDL = `
DROP TABLE IF EXISTS operations_history;
CREATE TABLE IF NOT EXISTS operations_history (
    id                   TEXT PRIMARY KEY,
    tool_id              TEXT NOT NULL,
    input_document_ids   TEXT NOT NULL DEFAULT '[]',
    output_document_ids  TEXT NOT NULL DEFAULT '[]',
    status               TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
    error_code           TEXT,
    duration_ms          INTEGER,
    created_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations_history(created_at);
CREATE INDEX IF NOT EXISTS idx_operations_tool ON operations_history(tool_id, created_at);`;

export const addToolHistory: Migration = {
  version: 8,
  name: 'tool-history',
  up: async (db) => {
    await db.execute(DDL);
  },
  down: async () => {
    // The 001 shape held no data in any release; nothing to restore.
  },
};
