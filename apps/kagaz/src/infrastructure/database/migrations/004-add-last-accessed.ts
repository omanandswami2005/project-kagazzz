/**
 * Migration 004 — documents.last_accessed_at (F-32 Recent Documents).
 *
 * Records when a document was last opened/previewed so the vault can
 * surface a "Recent" section and sort by recency. Nullable: a document
 * that has never been opened has no access time. Immutable once shipped.
 */
import type { Migration } from '../migration-runner';

/** Adds the recency column + an index for the "recent" query. */
export const addLastAccessed: Migration = {
  version: 4,
  name: 'add-last-accessed',
  up: async (db) => {
    await db.execute(
      'ALTER TABLE documents ADD COLUMN last_accessed_at TEXT;'
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_documents_last_accessed
         ON documents(last_accessed_at);`
    );
  },
  down: async (db) => {
    // SQLite can DROP COLUMN since 3.35; the bundled SQLCipher supports it.
    await db.execute('DROP INDEX IF EXISTS idx_documents_last_accessed;');
    await db.execute('ALTER TABLE documents DROP COLUMN last_accessed_at;');
  },
};
