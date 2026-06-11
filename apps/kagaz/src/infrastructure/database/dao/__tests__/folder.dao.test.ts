import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import type { SqlRow } from '../../connection';
import { FolderDao } from '../folder.dao';

function folderRow(overrides: SqlRow = {}): SqlRow {
  return {
    id: 'f-1',
    name: 'Identity',
    parent_id: null,
    icon: null,
    color: '#3498db',
    sort_order: 0,
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('FolderDao', () => {
  let db: FakeDb;
  let dao: FolderDao;

  beforeEach(() => {
    db = new FakeDb();
    dao = new FolderDao(db);
  });

  it('findById maps the row', async () => {
    db.onQuery(/FROM folders WHERE id/, [folderRow()]);
    expect(await dao.findById('f-1')).toMatchObject({
      id: 'f-1',
      name: 'Identity',
      parentId: undefined,
      color: '#3498db',
      sortOrder: 0,
    });
  });

  it('findById returns null when missing', async () => {
    expect(await dao.findById('missing')).toBeNull();
  });

  it('findChildren of root uses parent_id IS NULL', async () => {
    await dao.findChildren(null);
    expect(db.calls[0]?.sql).toContain('parent_id IS NULL');
  });

  it('findChildren of a folder binds the parent id', async () => {
    db.onQuery(/parent_id = \?/, [folderRow({ parent_id: 'f-0' })]);
    const children = await dao.findChildren('f-0');
    expect(children[0]?.parentId).toBe('f-0');
  });

  it('findAll orders by sort_order then name', async () => {
    await dao.findAll();
    expect(db.calls[0]?.sql).toContain('ORDER BY sort_order, name');
  });

  it('create inserts and returns the stored row', async () => {
    db.onQuery(/FROM folders WHERE id/, [folderRow()]);
    const folder = await dao.create({ name: 'Identity', sortOrder: 0 });
    expect(folder.name).toBe('Identity');
    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO folders'));
    expect(insert?.params?.[1]).toBe('Identity');
  });

  it('create throws if the row cannot be read back', async () => {
    await expect(dao.create({ name: 'x', sortOrder: 0 })).rejects.toThrow(
      'did not persist'
    );
  });

  it('update sets only provided fields', async () => {
    await dao.update('f-1', { name: 'Renamed', parentId: null, icon: '📁' });
    const sql = db.calls[0]?.sql ?? '';
    expect(sql).toContain('name = ?');
    expect(sql).toContain('parent_id = ?');
    expect(sql).toContain('icon = ?');
    expect(sql).not.toContain('color');
  });

  it('update covers color and sortOrder too', async () => {
    await dao.update('f-1', { color: null, sortOrder: 3 });
    const sql = db.calls[0]?.sql ?? '';
    expect(sql).toContain('color = ?');
    expect(sql).toContain('sort_order = ?');
  });

  it('update with empty patch is a no-op', async () => {
    expect(await dao.update('f-1', {})).toBe(0);
    expect(db.calls).toHaveLength(0);
  });

  it('delete removes the folder', async () => {
    expect(await dao.delete('f-1')).toBe(1);
    expect(db.calls[0]?.sql).toBe('DELETE FROM folders WHERE id = ?');
  });
});
