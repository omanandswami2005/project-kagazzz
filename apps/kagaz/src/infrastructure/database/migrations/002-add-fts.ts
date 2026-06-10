/**
 * Migration 002 — FTS5 full-text search
 * (docs/architecture/09-database-design.md §6).
 *
 * External-content FTS5 table over documents(name, description, ocr_text)
 * with unicode61 + remove_diacritics 2 for Hindi/English search, kept in
 * sync via insert/update/delete triggers. Immutable once shipped.
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

CREATE TRIGGER IF NOT EXISTS documents_fts_update AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, name, description, ocr_text)
    VALUES ('delete', old.rowid, old.name, old.description, old.ocr_text);
    INSERT INTO documents_fts(rowid, name, description, ocr_text)
    VALUES (new.rowid, new.name, new.description, new.ocr_text);
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_delete AFTER DELETE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, name, description, ocr_text)
    VALUES ('delete', old.rowid, old.name, old.description, old.ocr_text);
END;`;

const DROP_DDL = `
DROP TRIGGER IF EXISTS documents_fts_delete;
DROP TRIGGER IF EXISTS documents_fts_update;
DROP TRIGGER IF EXISTS documents_fts_insert;
DROP TABLE IF EXISTS documents_fts;`;

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
