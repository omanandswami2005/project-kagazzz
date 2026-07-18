/**
 * Migration 005 — quick_reference_entries + quick_reference_tags (F-84
 * Quick Reference, docs/architecture/09-database-design.md §4.12).
 *
 * `label` is always user-typed free text — deliberately no `label_type`/
 * `value_type` column (see 10-security-architecture.md §3.6 for the
 * UIDAI-alignment rationale). Immutable once shipped.
 */
import type { Migration } from '../migration-runner';

const TABLES_DDL = `
CREATE TABLE IF NOT EXISTS quick_reference_entries (
    id                 TEXT PRIMARY KEY,
    label              TEXT NOT NULL,
    value              TEXT NOT NULL,
    linked_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quick_reference_tags (
    entry_id TEXT NOT NULL REFERENCES quick_reference_entries(id) ON DELETE CASCADE,
    tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, tag_id)
);`;

const INDEXES_DDL = `
CREATE INDEX IF NOT EXISTS idx_quick_reference_linked_document ON quick_reference_entries(linked_document_id);
CREATE INDEX IF NOT EXISTS idx_quick_reference_tags_tag_id ON quick_reference_tags(tag_id);`;

const DROP_DDL = `
DROP TABLE IF EXISTS quick_reference_tags;
DROP TABLE IF EXISTS quick_reference_entries;`;

/** F-84 Quick Reference tables + indexes. */
export const addQuickReference: Migration = {
  version: 5,
  name: 'add-quick-reference',
  up: async (db) => {
    await db.execute(TABLES_DDL);
    await db.execute(INDEXES_DDL);
  },
  down: async (db) => {
    await db.execute(DROP_DDL);
  },
};
