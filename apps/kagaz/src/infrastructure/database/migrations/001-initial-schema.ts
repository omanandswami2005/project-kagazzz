/**
 * Migration 001 — initial V1 schema.
 *
 * DDL verbatim from docs/architecture/09-database-design.md §4–§5 (V1
 * tables + indexes only; V2/V3 tables ship with their own versions'
 * migrations per the version dependency rule). Immutable once shipped.
 */
import type { Migration } from '../migration-runner';

const TABLES_DDL = `
CREATE TABLE IF NOT EXISTS folders (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    parent_id  TEXT REFERENCES folders(id) ON DELETE CASCADE,
    icon       TEXT,
    color      TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT,
    file_path      TEXT NOT NULL,
    file_type      TEXT NOT NULL,
    file_size      INTEGER NOT NULL,
    file_hash      TEXT,
    thumbnail_path TEXT,
    folder_id      TEXT REFERENCES folders(id) ON DELETE SET NULL,
    is_favorite    INTEGER DEFAULT 0,
    is_locked      INTEGER DEFAULT 0,
    is_archived    INTEGER DEFAULT 0,
    language       TEXT DEFAULT 'en',
    ocr_text       TEXT,
    source_type    TEXT NOT NULL CHECK (source_type IN (
        'camera', 'scanner', 'gallery', 'file_picker', 'ai_generated'
    )),
    original_filename TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    deleted_at     TEXT,
    metadata_json  TEXT,
    synced         INTEGER DEFAULT 0,
    version        INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tags (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_tags (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE IF NOT EXISTS operations_history (
    id                  TEXT PRIMARY KEY,
    document_id         TEXT REFERENCES documents(id) ON DELETE SET NULL,
    operation_type      TEXT NOT NULL CHECK (operation_type IN (
        'merge', 'split', 'compress', 'convert', 'encrypt',
        'decrypt', 'ocr', 'watermark', 'annotate', 'resize'
    )),
    input_params_json   TEXT,
    output_document_id  TEXT REFERENCES documents(id) ON DELETE SET NULL,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed'
    )),
    error_message       TEXT,
    duration_ms         INTEGER,
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_conversations (
    id         TEXT PRIMARY KEY,
    title      TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_pinned  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content         TEXT,
    tool_calls_json TEXT,
    tool_call_id    TEXT,
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TEXT NOT NULL
);`;

const INDEXES_DDL = `
CREATE INDEX IF NOT EXISTS idx_documents_folder_id   ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_type   ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_is_favorite ON documents(is_favorite) WHERE is_favorite = 1;
CREATE INDEX IF NOT EXISTS idx_documents_created_at  ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at  ON documents(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_synced      ON documents(synced) WHERE synced = 0;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_operations_document_id ON operations_history(document_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations_history(status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);`;

const DROP_DDL = `
DROP TABLE IF EXISTS ai_messages;
DROP TABLE IF EXISTS ai_conversations;
DROP TABLE IF EXISTS operations_history;
DROP TABLE IF EXISTS document_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS folders;
DROP TABLE IF EXISTS app_settings;`;

/** Initial V1 schema: tables (§4) and indexes (§5). */
export const initialSchema: Migration = {
  version: 1,
  name: 'initial-schema',
  up: async (db) => {
    await db.execute(TABLES_DDL);
    await db.execute(INDEXES_DDL);
  },
  down: async (db) => {
    await db.execute(DROP_DDL);
  },
};
