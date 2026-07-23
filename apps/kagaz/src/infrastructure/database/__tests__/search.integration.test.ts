/**
 * Real-SQLite regression test for full-text search (F-11,
 * 09-database-design.md §6). Every other DB test in this codebase runs
 * against `FakeDb` (a regex-matching stub) — real, so a JOIN/MATCH typo or a
 * "no such module: fts5" runtime gap would pass every existing test while
 * being completely broken on-device. This file runs the actual migrations
 * and DocumentDao.search() against `node:sqlite` (real SQLite, FTS5
 * compiled in, zero new dependencies) to close that gap.
 *
 * Forced onto the real `node` environment (not the workspace-default
 * `jsdom`): this file needs no DOM at all, and on CI's pinned Node 22,
 * jsdom's environment/transform path doesn't reliably recognize `node:sqlite`
 * as an externalizable Node builtin — Vite tries to bundle it and fails
 * ("Cannot bundle Node.js built-in \"node:sqlite\""). The plain `node`
 * environment runs this file directly against the real Node runtime with no
 * such shimming, which is also the architecturally correct choice for a
 * pure backend/DB test.
 * @vitest-environment node
 */
import { DatabaseSync, type StatementResultingChanges } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DbConnection, SqlValue } from '../connection';
import { DocumentDao } from '../dao/document.dao';
import { migrations } from '../migrations';
import { runMigrations } from '../migration-runner';
import { buildFtsMatchQuery } from '@/modules/search/services/search.service';

/** Minimal DbConnection over node:sqlite's synchronous driver. */
function connect(): DbConnection {
  const db = new DatabaseSync(':memory:');
  const conn: DbConnection = {
    query: (sql, params: SqlValue[] = []) =>
      Promise.resolve(db.prepare(sql).all(...params) as Record<string, unknown>[]),
    run: (sql, params: SqlValue[] = []) => {
      const result: StatementResultingChanges = db.prepare(sql).run(...params);
      return Promise.resolve({ changes: Number(result.changes) });
    },
    execute: (sql) => {
      db.exec(sql);
      return Promise.resolve();
    },
    transaction: async (fn) => {
      db.exec('BEGIN');
      try {
        const result = await fn(conn);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return conn;
}

async function seedDocument(
  dao: DocumentDao,
  overrides: { name: string; ocrText?: string }
): Promise<void> {
  await dao.create({
    name: overrides.name,
    filePath: '/vault/doc.pdf',
    fileType: 'pdf',
    fileSize: 1024,
    isFavorite: false,
    isLocked: false,
    isArchived: false,
    language: 'en',
    ocrText: overrides.ocrText,
    sourceType: 'file_picker',
  });
}

describe('document search against real SQLite (F-11)', () => {
  it('runs the full migration chain and returns ranked FTS results', async () => {
    const db = connect();
    await runMigrations(db, migrations);
    const dao = new DocumentDao(db);
    await seedDocument(dao, { name: 'Passport Copy', ocrText: 'passport number 12345' });
    await seedDocument(dao, { name: 'Electricity Bill' });

    const match = buildFtsMatchQuery('passport');
    expect(match).not.toBeNull();
    const results = await dao.search(match as string, 10);

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Passport Copy');
  });

  it('excludes soft-deleted documents from results', async () => {
    const db = connect();
    await runMigrations(db, migrations);
    const dao = new DocumentDao(db);
    await seedDocument(dao, { name: 'Old Aadhaar Scan' });
    const [row] = await db.query('SELECT id FROM documents');
    await db.run('UPDATE documents SET deleted_at = ? WHERE id = ?', [
      new Date().toISOString(),
      row?.['id'] as string,
    ]);

    const results = await dao.search(buildFtsMatchQuery('aadhaar') as string, 10);
    expect(results).toHaveLength(0);
  });

  it('falls back to a LIKE scan when documents_fts is absent, with the same AND/OR semantics', async () => {
    const db = connect();
    // Simulates the on-device "no such module: fts5" gap migration 002
    // guards against: its DDL never runs, so neither the table nor its sync
    // triggers exist — not merely dropping the table after the fact.
    await runMigrations(
      db,
      migrations.filter((m) => m.version !== 2)
    );
    const dao = new DocumentDao(db);
    await seedDocument(dao, { name: 'Passport Copy', ocrText: 'passport number 12345' });
    await seedDocument(dao, { name: 'Electricity Bill' });

    const results = await dao.search(buildFtsMatchQuery('passport') as string, 10);

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Passport Copy');
  });
});
