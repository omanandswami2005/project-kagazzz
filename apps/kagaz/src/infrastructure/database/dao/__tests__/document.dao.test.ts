import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import type { SqlRow } from '../../connection';
import { DocumentDao } from '../document.dao';

function docRow(overrides: SqlRow = {}): SqlRow {
  return {
    id: 'doc-1',
    name: 'PAN Card',
    description: null,
    file_path: 'documents/doc-1.pdf',
    file_type: 'application/pdf',
    file_size: 1024,
    file_hash: null,
    thumbnail_path: null,
    folder_id: null,
    is_favorite: 0,
    is_locked: 1,
    is_archived: 0,
    language: 'en',
    ocr_text: null,
    source_type: 'file_picker',
    original_filename: 'pan.pdf',
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    deleted_at: null,
    metadata_json: null,
    synced: 0,
    version: 1,
    ...overrides,
  };
}

describe('DocumentDao', () => {
  let db: FakeDb;
  let dao: DocumentDao;

  beforeEach(() => {
    db = new FakeDb();
    dao = new DocumentDao(db);
  });

  it('findById maps snake_case row to camelCase entity', async () => {
    db.onQuery(/FROM documents WHERE id/, [docRow()]);
    const doc = await dao.findById('doc-1');
    expect(doc).toMatchObject({
      id: 'doc-1',
      filePath: 'documents/doc-1.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      isFavorite: false,
      isLocked: true,
      synced: false,
      sourceType: 'file_picker',
      originalFilename: 'pan.pdf',
    });
  });

  it('findById returns null when not found', async () => {
    expect(await dao.findById('missing')).toBeNull();
  });

  it('findByFolder queries folder_id IS NULL for the root', async () => {
    await dao.findByFolder(null);
    expect(db.calls[0]?.sql).toContain('folder_id IS NULL');
    expect(db.calls[0]?.params).toEqual([]);
  });

  it('findByFolder binds the folder id otherwise', async () => {
    db.onQuery(/folder_id = \?/, [docRow()]);
    const docs = await dao.findByFolder('f-1');
    expect(docs).toHaveLength(1);
    expect(db.calls[0]?.params).toEqual(['f-1']);
  });

  it('findRecent filters last_accessed_at, orders desc, binds limit', async () => {
    db.onQuery(/last_accessed_at IS NOT NULL/, [
      docRow({ last_accessed_at: '2026-06-11T00:00:00.000Z' }),
    ]);
    const docs = await dao.findRecent(5);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.lastAccessedAt).toBe('2026-06-11T00:00:00.000Z');
    expect(db.calls[0]?.sql).toContain('ORDER BY last_accessed_at DESC');
    expect(db.calls[0]?.params).toEqual([5]);
  });

  it('touchLastAccessed stamps the access time on live rows', async () => {
    const changes = await dao.touchLastAccessed('doc-1');
    expect(changes).toBe(1);
    const call = db.calls[0];
    expect(call?.sql).toContain('SET last_accessed_at = ?');
    expect(call?.sql).toContain('deleted_at IS NULL');
    expect(call?.params?.[1]).toBe('doc-1');
  });

  it('findFavorites filters is_favorite and excludes deleted', async () => {
    db.onQuery(/is_favorite = 1/, [docRow({ is_favorite: 1 })]);
    const docs = await dao.findFavorites();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.isFavorite).toBe(true);
    expect(db.calls[0]?.sql).toContain('deleted_at IS NULL');
  });

  it('create inserts with generated id, timestamps, synced=0, version=1', async () => {
    db.onQuery(/FROM documents WHERE id/, [docRow()]);
    await dao.create({
      name: 'PAN Card',
      filePath: 'documents/doc-1.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      isFavorite: false,
      isLocked: true,
      isArchived: false,
      language: 'en',
      sourceType: 'file_picker',
      originalFilename: 'pan.pdf',
    });
    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO documents'));
    expect(insert).toBeDefined();
    expect(insert?.sql).toContain('?, 0, 1)');
    expect(insert?.params?.[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(insert?.params).toContain('file_picker');
  });

  it('create throws if the inserted row cannot be read back', async () => {
    await expect(
      dao.create({
        name: 'x',
        filePath: 'p',
        fileType: 't',
        fileSize: 1,
        isFavorite: false,
        isLocked: false,
        isArchived: false,
        language: 'en',
        sourceType: 'camera',
      })
    ).rejects.toThrow('did not persist');
  });

  it('update builds SET clauses only for provided fields and bumps version', async () => {
    const changes = await dao.update('doc-1', {
      name: 'Renamed',
      folderId: null,
      isFavorite: true,
      description: 'd',
    });
    expect(changes).toBe(1);
    const update = db.calls[0];
    expect(update?.sql).toContain('name = ?');
    expect(update?.sql).toContain('folder_id = ?');
    expect(update?.sql).toContain('is_favorite = ?');
    expect(update?.sql).toContain('version = version + 1');
    expect(update?.sql).not.toContain('ocr_text');
    expect(update?.params).toContain('Renamed');
    expect(update?.params).toContain(null);
    expect(update?.params).toContain(1);
  });

  it('update covers all updatable columns', async () => {
    await dao.update('doc-1', {
      name: 'n',
      description: null,
      folderId: 'f',
      isFavorite: false,
      isLocked: true,
      isArchived: true,
      language: 'hi',
      ocrText: 'text',
      thumbnailPath: null,
      metadataJson: '{}',
    });
    const sql = db.calls[0]?.sql ?? '';
    for (const col of [
      'name',
      'description',
      'folder_id',
      'is_favorite',
      'is_locked',
      'is_archived',
      'language',
      'ocr_text',
      'thumbnail_path',
      'metadata_json',
    ]) {
      expect(sql).toContain(`${col} = ?`);
    }
  });

  it('update with an empty patch is a no-op', async () => {
    expect(await dao.update('doc-1', {})).toBe(0);
    expect(db.calls).toHaveLength(0);
  });

  it('softDelete stamps deleted_at on live rows only', async () => {
    await dao.softDelete('doc-1');
    expect(db.calls[0]?.sql).toContain('SET deleted_at = ?');
    expect(db.calls[0]?.sql).toContain('deleted_at IS NULL');
  });

  it('restore clears deleted_at on deleted rows only', async () => {
    await dao.restore('doc-1');
    expect(db.calls[0]?.sql).toContain('SET deleted_at = NULL');
    expect(db.calls[0]?.sql).toContain('deleted_at IS NOT NULL');
  });

  it('search joins documents_fts, excludes deleted, binds limit', async () => {
    db.onQuery(/documents_fts MATCH/, [docRow()]);
    const results = await dao.search('pan*', 5);
    expect(results).toHaveLength(1);
    expect(db.calls[0]?.sql).toContain('ORDER BY rank');
    expect(db.calls[0]?.params).toEqual(['pan*', 5]);
  });

  it('search defaults to 20 results', async () => {
    await dao.search('aadhaar');
    expect(db.calls[0]?.params).toEqual(['aadhaar', 20]);
  });
});
