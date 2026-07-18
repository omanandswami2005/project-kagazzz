import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import { QuickReferenceDao } from '../quick-reference.dao';

const entryRow = {
  id: 'q-1',
  label: 'PAN No',
  value: 'ABCDE1234F',
  linked_document_id: null,
  created_at: '2026-07-18T00:00:00.000Z',
  updated_at: '2026-07-18T00:00:00.000Z',
};

const tagRow = {
  id: 't-1',
  name: 'finance',
  color: null,
  created_at: '2026-06-10T00:00:00.000Z',
};

describe('QuickReferenceDao (F-84)', () => {
  let db: FakeDb;
  let dao: QuickReferenceDao;

  beforeEach(() => {
    db = new FakeDb();
    dao = new QuickReferenceDao(db);
  });

  it('findById maps the row, null when missing', async () => {
    db.onQuery(/FROM quick_reference_entries WHERE id/, [entryRow]);
    expect(await dao.findById('q-1')).toMatchObject({
      id: 'q-1',
      label: 'PAN No',
      value: 'ABCDE1234F',
      linkedDocumentId: undefined,
    });
    db.calls.length = 0;
    const empty = new QuickReferenceDao(new FakeDb());
    expect(await empty.findById('x')).toBeNull();
  });

  it('findAll orders by most recently updated', async () => {
    await dao.findAll();
    expect(db.calls[0]?.sql).toContain('ORDER BY updated_at DESC');
  });

  it('findByDocument filters by linked_document_id', async () => {
    db.onQuery(/WHERE linked_document_id/, [entryRow]);
    const entries = await dao.findByDocument('doc-1');
    expect(entries).toHaveLength(1);
    expect(db.calls[0]?.params).toEqual(['doc-1']);
  });

  it('create inserts label/value verbatim with a generated id + timestamps', async () => {
    db.onQuery(/FROM quick_reference_entries WHERE id/, [entryRow]);
    const entry = await dao.create('PAN No', 'ABCDE1234F');
    expect(entry.label).toBe('PAN No');
    const insert = db.calls.find((c) =>
      c.sql.includes('INSERT INTO quick_reference_entries')
    );
    expect(insert?.params?.[1]).toBe('PAN No');
    expect(insert?.params?.[2]).toBe('ABCDE1234F');
    expect(insert?.params?.[3]).toBeNull();
  });

  it('create stores a linked document id when given', async () => {
    db.onQuery(/FROM quick_reference_entries WHERE id/, [entryRow]);
    await dao.create('PAN No', 'ABCDE1234F', 'doc-1');
    const insert = db.calls.find((c) =>
      c.sql.includes('INSERT INTO quick_reference_entries')
    );
    expect(insert?.params?.[3]).toBe('doc-1');
  });

  it('create throws if the row cannot be read back', async () => {
    await expect(dao.create('ghost', 'x')).rejects.toThrow('did not persist');
  });

  it('update only sets provided fields, always bumps updated_at', async () => {
    await dao.update('q-1', { value: 'NEWVALUE1' });
    const call = db.calls[0];
    expect(call?.sql).toContain('value = ?');
    expect(call?.sql).not.toContain('label = ?');
    expect(call?.sql).toContain('updated_at = ?');
  });

  it('update is a no-op when nothing is provided', async () => {
    expect(await dao.update('q-1', {})).toBe(0);
    expect(db.calls).toHaveLength(0);
  });

  it('delete removes the entry', async () => {
    expect(await dao.delete('q-1')).toBe(1);
    expect(db.calls[0]?.sql).toContain('DELETE FROM quick_reference_entries');
  });

  it('findAllTagAssignments returns entryId + mapped tag', async () => {
    db.onQuery(/FROM quick_reference_tags qt\s+JOIN tags/, [
      { ...tagRow, entry_id: 'q-1' },
    ]);
    const result = await dao.findAllTagAssignments();
    expect(result).toHaveLength(1);
    expect(result[0]?.entryId).toBe('q-1');
    expect(result[0]?.tag.name).toBe('finance');
  });

  it('attachTag is idempotent via INSERT OR IGNORE', async () => {
    await dao.attachTag('q-1', 't-1');
    expect(db.calls[0]?.sql).toContain('INSERT OR IGNORE INTO quick_reference_tags');
    expect(db.calls[0]?.params).toEqual(['q-1', 't-1']);
  });

  it('detachTag removes the junction row', async () => {
    expect(await dao.detachTag('q-1', 't-1')).toBe(1);
    expect(db.calls[0]?.sql).toContain('DELETE FROM quick_reference_tags');
  });
});
