import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import { TagDao } from '../tag.dao';

const tagRow = {
  id: 't-1',
  name: 'urgent',
  color: null,
  created_at: '2026-06-10T00:00:00.000Z',
};

describe('TagDao', () => {
  let db: FakeDb;
  let dao: TagDao;

  beforeEach(() => {
    db = new FakeDb();
    dao = new TagDao(db);
  });

  it('findById maps the row, null when missing', async () => {
    db.onQuery(/FROM tags WHERE id/, [tagRow]);
    expect(await dao.findById('t-1')).toMatchObject({
      id: 't-1',
      name: 'urgent',
      color: undefined,
    });
    db.calls.length = 0;
    const empty = new TagDao(new FakeDb());
    expect(await empty.findById('x')).toBeNull();
  });

  it('findAll orders by name', async () => {
    await dao.findAll();
    expect(db.calls[0]?.sql).toContain('ORDER BY name');
  });

  it('findByDocument joins through document_tags', async () => {
    db.onQuery(/JOIN document_tags/, [tagRow]);
    const tags = await dao.findByDocument('doc-1');
    expect(tags).toHaveLength(1);
    expect(db.calls[0]?.params).toEqual(['doc-1']);
  });

  it('create inserts with generated id and timestamp', async () => {
    db.onQuery(/FROM tags WHERE id/, [tagRow]);
    const tag = await dao.create('urgent');
    expect(tag.name).toBe('urgent');
    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO tags'));
    expect(insert?.params?.[1]).toBe('urgent');
    expect(insert?.params?.[2]).toBeNull();
  });

  it('create throws if the row cannot be read back', async () => {
    await expect(dao.create('ghost')).rejects.toThrow('did not persist');
  });

  it('delete removes the tag', async () => {
    expect(await dao.delete('t-1')).toBe(1);
  });

  it('attach is idempotent via INSERT OR IGNORE', async () => {
    await dao.attach('doc-1', 't-1');
    expect(db.calls[0]?.sql).toContain('INSERT OR IGNORE INTO document_tags');
    expect(db.calls[0]?.params).toEqual(['doc-1', 't-1']);
  });

  it('detach removes the junction row', async () => {
    expect(await dao.detach('doc-1', 't-1')).toBe(1);
    expect(db.calls[0]?.sql).toContain('DELETE FROM document_tags');
  });
});
