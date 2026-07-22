/**
 * Migration 002 — FTS5 full-text search
 * (docs/architecture/09-database-design.md §6).
 *
 * External-content FTS5 table over documents(name, description, ocr_text)
 * with unicode61 + remove_diacritics 2 for Hindi/English search, kept in
 * sync via insert/update/delete triggers.
 *
 * AUTHORING RULE — every trigger body must hold EXACTLY ONE statement.
 * The native `@capacitor-community/sqlite` splitter
 * (UtilsSQLite.concatRemoveEnd) rejoins only a single statement before
 * `END;`, so a two-statement BEGIN…END body fails on device with
 * "incomplete input". The FTS5 update sync (delete-then-reinsert) is
 * therefore expressed as TWO single-statement AFTER UPDATE triggers;
 * SQLite fires them in creation order (del → ins) for the same result.
 * (The splitter's other quirk — needing a trailing newline — is handled
 * centrally by SqliteDbAdapter.execute. Both constraints are covered by
 * the native-splitter regression test in migrations.test.ts.)
 *
 * FTS5-UNAVAILABLE FALLBACK — some Android SQLCipher builds omit the FTS5
 * module at runtime ("no such module: fts5") even though the DDL itself is
 * correct; this is a documented, recurring gap across multiple SQLite
 * wrapper libraries on Android, not a bug in this migration. If it happens
 * here, the whole migration chain must not die with it (migrations 3+ still
 * need to run) — so `up` catches exactly that error and leaves
 * `documents_fts` absent. `DocumentDao.search()` checks for the table and
 * falls back to a plain `LIKE` scan when it's missing, so search degrades
 * instead of the app failing to open.
 */
import type { Migration } from '../migration-runner';

const FTS_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    name,
    description,
    ocr_text,
    content='documents',
    content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS documents_fts_insert AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid, name, description, ocr_text)
    VALUES (new.rowid, new.name, new.description, new.ocr_text);
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_update_del AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, name, description, ocr_text)
    VALUES ('delete', old.rowid, old.name, old.description, old.ocr_text);
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_update_ins AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(rowid, name, description, ocr_text)
    VALUES (new.rowid, new.name, new.description, new.ocr_text);
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_delete AFTER DELETE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, name, description, ocr_text)
    VALUES ('delete', old.rowid, old.name, old.description, old.ocr_text);
END;
`;

const DROP_DDL = `
DROP TRIGGER IF EXISTS documents_fts_delete;
DROP TRIGGER IF EXISTS documents_fts_update_ins;
DROP TRIGGER IF EXISTS documents_fts_update_del;
DROP TRIGGER IF EXISTS documents_fts_insert;
DROP TABLE IF EXISTS documents_fts;
`;

/** True for the specific "FTS5 module not compiled in" runtime error. */
function isFts5Unavailable(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return message.includes('fts5') && message.includes('no such module');
}

/** FTS5 virtual table + sync triggers for document search. */
export const addFts: Migration = {
  version: 2,
  name: 'add-fts',
  up: async (db) => {
    try {
      await db.execute(FTS_DDL);
    } catch (error) {
      if (!isFts5Unavailable(error)) {
        throw error;
      }
      // See the FTS5-UNAVAILABLE FALLBACK note above — leave documents_fts
      // absent; DocumentDao.search() falls back to LIKE.
    }
  },
  down: async (db) => {
    await db.execute(DROP_DDL);
  },
};
