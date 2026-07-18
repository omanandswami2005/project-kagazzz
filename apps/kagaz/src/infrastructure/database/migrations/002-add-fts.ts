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

/** FTS5 virtual table + sync triggers for document search. */
export const addFts: Migration = {
  version: 2,
  name: 'add-fts',
  up: async (db) => {
    await db.execute(FTS_DDL);
  },
  down: async (db) => {
    await db.execute(DROP_DDL);
  },
};
