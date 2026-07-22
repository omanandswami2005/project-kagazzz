import { describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import { initialSchema } from '../migrations/001-initial-schema';
import { addFts } from '../migrations/002-add-fts';
import { addLogging } from '../migrations/003-add-logging';
import { addLastAccessed } from '../migrations/004-add-last-accessed';
import { addQuickReference } from '../migrations/005-add-quick-reference';
import { addQuickReferenceSecurityFlag } from '../migrations/006-add-quick-reference-security-flag';
import { migrations } from '../migrations';

describe('migration registry', () => {
  it('contains all migrations in ascending, gapless version order', () => {
    const versions = migrations.map((m) => m.version);
    expect(versions).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('004-add-last-accessed', () => {
  it('adds the column and its index', async () => {
    const db = new FakeDb();
    await addLastAccessed.up(db);
    expect(db.allSql).toContain(
      'ALTER TABLE documents ADD COLUMN last_accessed_at'
    );
    expect(db.allSql).toContain('idx_documents_last_accessed');
  });

  it('down drops the column and index', async () => {
    const db = new FakeDb();
    await addLastAccessed.down(db);
    expect(db.allSql).toContain('DROP INDEX IF EXISTS idx_documents_last_accessed');
    expect(db.allSql).toContain('DROP COLUMN last_accessed_at');
  });
});

describe('005-add-quick-reference', () => {
  it('creates the entries + tags-junction tables and their indexes', async () => {
    const db = new FakeDb();
    await addQuickReference.up(db);
    expect(db.allSql).toContain(
      'CREATE TABLE IF NOT EXISTS quick_reference_entries'
    );
    expect(db.allSql).toContain(
      'CREATE TABLE IF NOT EXISTS quick_reference_tags'
    );
    expect(db.allSql).toContain('idx_quick_reference_linked_document');
    expect(db.allSql).toContain('idx_quick_reference_tags_tag_id');
    // No label_type/value_type column — see 10-security-architecture.md §3.6.
    expect(db.allSql).not.toContain('label_type');
    expect(db.allSql).not.toContain('value_type');
  });

  it('down drops both tables', async () => {
    const db = new FakeDb();
    await addQuickReference.down(db);
    expect(db.allSql).toContain('DROP TABLE IF EXISTS quick_reference_tags');
    expect(db.allSql).toContain(
      'DROP TABLE IF EXISTS quick_reference_entries'
    );
  });
});

describe('006-add-quick-reference-security-flag', () => {
  it('adds the column, defaulting existing rows to secure (1)', async () => {
    const db = new FakeDb();
    await addQuickReferenceSecurityFlag.up(db);
    expect(db.allSql).toContain(
      'ALTER TABLE quick_reference_entries ADD COLUMN is_secure INTEGER NOT NULL DEFAULT 1'
    );
  });

  it('down is a documented no-op (no DROP COLUMN support assumed)', async () => {
    const db = new FakeDb();
    await addQuickReferenceSecurityFlag.down(db);
    expect(db.calls).toEqual([]);
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

describe('003-add-logging', () => {
  it('creates app_logs (with time index) and audit_logs', async () => {
    const db = new FakeDb();
    await addLogging.up(db);
    expect(db.allSql).toContain('CREATE TABLE IF NOT EXISTS app_logs');
    expect(db.allSql).toContain('idx_app_logs_time');
    expect(db.allSql).toContain('CREATE TABLE IF NOT EXISTS audit_logs');
    expect(db.allSql).toContain('record_hash TEXT NOT NULL');
  });

  it('down drops both tables', async () => {
    const db = new FakeDb();
    await addLogging.down(db);
    expect(db.allSql).toContain('DROP TABLE IF EXISTS audit_logs');
    expect(db.allSql).toContain('DROP TABLE IF EXISTS app_logs');
  });
});

describe('002-add-fts', () => {
  it('creates the FTS5 table with unicode61 tokenizer and sync triggers', async () => {
    const db = new FakeDb();
    await addFts.up(db);
    expect(db.allSql).toContain('USING fts5');
    expect(db.allSql).toContain("tokenize='unicode61 remove_diacritics 2'");
    expect(db.allSql).toContain('documents_fts_insert');
    // UPDATE sync is two single-statement triggers (native splitter limit).
    expect(db.allSql).toContain('documents_fts_update_del');
    expect(db.allSql).toContain('documents_fts_update_ins');
    expect(db.allSql).toContain('documents_fts_delete');
  });

  it('down drops triggers and the FTS table', async () => {
    const db = new FakeDb();
    await addFts.down(db);
    expect(db.allSql).toContain('DROP TRIGGER IF EXISTS documents_fts_insert');
    expect(db.allSql).toContain(
      'DROP TRIGGER IF EXISTS documents_fts_update_ins'
    );
    expect(db.allSql).toContain('DROP TABLE IF EXISTS documents_fts');
  });
});

/**
 * Regression guard for the native `@capacitor-community/sqlite` splitter
 * (UtilsSQLite.java). Mocked unit tests never exercise it, so two real
 * device failures slipped through F-1: a two-statement trigger body, and
 * a DDL that didn't end in a newline — both produced "incomplete input"
 * and aborted DB open. This faithfully reproduces the splitter in JS and
 * asserts every statement it emits is well-formed for ALL migrations.
 */
describe('native SQLite splitter compatibility', () => {
  /**
   * Port of UtilsSQLite.splitStatements: lowercase `end;` is normalized,
   * the blob is split on ";\n", then trigger bodies are rejoined by
   * appending "; END" to the statement preceding each standalone "END"
   * token (concatRemoveEnd). A trigger whose `END;` lacks a trailing
   * newline tokenizes as "END;" (not "END") and is never rejoined.
   */
  function splitLikePlugin(statements: string): string[] {
    const stmts = statements.replace(/end;/g, 'END;');
    let parts = stmts
      .split(';\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // concatRemoveEnd: fold each standalone "END" into the prior statement.
    for (let i = parts.indexOf('END'); i > 0; i = parts.indexOf('END')) {
      parts[i - 1] = `${parts[i - 1]}; END`;
      parts = parts.filter((_, idx) => idx !== i);
    }
    return parts;
  }

  /** A statement is malformed if it opens a trigger body it never closes. */
  function hasUnclosedTrigger(stmt: string): boolean {
    return /\bBEGIN\b/i.test(stmt) && !/\bEND\b/i.test(stmt);
  }

  /** Mirror SqliteDbAdapter.execute: guarantee a trailing newline. */
  const normalize = (sql: string): string =>
    sql.endsWith('\n') ? sql : `${sql}\n`;

  it('every migration up() splits into well-formed statements', async () => {
    for (const migration of migrations) {
      const db = new FakeDb();
      await migration.up(db);
      for (const call of db.calls.filter((c) => c.kind === 'execute')) {
        for (const stmt of splitLikePlugin(normalize(call.sql))) {
          expect(
            hasUnclosedTrigger(stmt),
            `unclosed trigger in ${migration.name}: ${stmt.slice(0, 80)}`
          ).toBe(false);
        }
      }
    }
  });

  it('reproduces both real F-1 failures (two-statement body, no trailing \\n)', () => {
    const twoStatementBody =
      'CREATE TRIGGER t AFTER UPDATE ON x BEGIN\n' +
      '  INSERT INTO y VALUES(1);\n' +
      '  INSERT INTO z VALUES(2);\n' +
      'END;\n';
    expect(splitLikePlugin(twoStatementBody).some(hasUnclosedTrigger)).toBe(
      true
    );

    const noTrailingNewline =
      'CREATE TRIGGER t AFTER DELETE ON x BEGIN\n' +
      '  INSERT INTO y VALUES(1);\n' +
      'END;'; // <- no trailing newline
    expect(splitLikePlugin(noTrailingNewline).some(hasUnclosedTrigger)).toBe(
      true
    );

    const correct =
      'CREATE TRIGGER t AFTER DELETE ON x BEGIN\n' +
      '  INSERT INTO y VALUES(1);\n' +
      'END;\n';
    expect(splitLikePlugin(correct).some(hasUnclosedTrigger)).toBe(false);
  });
});
