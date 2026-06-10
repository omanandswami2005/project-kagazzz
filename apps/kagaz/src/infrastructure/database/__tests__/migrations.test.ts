import { describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import { initialSchema } from '../migrations/001-initial-schema';
import { addFts } from '../migrations/002-add-fts';
import { migrations } from '../migrations';

describe('migration registry', () => {
  it('contains all migrations in ascending, gapless version order', () => {
    const versions = migrations.map((m) => m.version);
    expect(versions).toEqual([1, 2]);
  });
});

describe('001-initial-schema', () => {
  it('creates every V1 table and index from 09-database-design', async () => {
    const db = new FakeDb();
    await initialSchema.up(db);
    for (const table of [
      'folders',
      'documents',
      'tags',
      'document_tags',
      'operations_history',
      'ai_conversations',
      'ai_messages',
      'app_settings',
    ]) {
      expect(db.allSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(db.allSql).toContain('idx_documents_folder_id');
    expect(db.allSql).toContain('idx_documents_created_at');
    expect(db.allSql).toContain('idx_ai_messages_conversation');
    // V2/V3 tables must NOT ship in V1 (version dependency rule).
    expect(db.allSql).not.toContain('shared_links');
    expect(db.allSql).not.toContain('csc_services');
  });

  it('down drops the V1 tables', async () => {
    const db = new FakeDb();
    await initialSchema.down(db);
    expect(db.allSql).toContain('DROP TABLE IF EXISTS documents');
    expect(db.allSql).toContain('DROP TABLE IF EXISTS folders');
  });
});

describe('002-add-fts', () => {
  it('creates the FTS5 table with unicode61 tokenizer and sync triggers', async () => {
    const db = new FakeDb();
    await addFts.up(db);
    expect(db.allSql).toContain('USING fts5');
    expect(db.allSql).toContain("tokenize='unicode61 remove_diacritics 2'");
    expect(db.allSql).toContain('documents_fts_insert');
    expect(db.allSql).toContain('documents_fts_update');
    expect(db.allSql).toContain('documents_fts_delete');
  });

  it('down drops triggers and the FTS table', async () => {
    const db = new FakeDb();
    await addFts.down(db);
    expect(db.allSql).toContain('DROP TRIGGER IF EXISTS documents_fts_insert');
    expect(db.allSql).toContain('DROP TABLE IF EXISTS documents_fts');
  });
});
