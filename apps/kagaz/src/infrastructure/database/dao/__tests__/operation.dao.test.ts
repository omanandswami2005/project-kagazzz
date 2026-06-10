import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import type { SqlRow } from '../../connection';
import { OperationDao } from '../operation.dao';

function opRow(overrides: SqlRow = {}): SqlRow {
  return {
    id: 'op-1',
    document_id: 'doc-1',
    operation_type: 'merge',
    input_params_json: null,
    output_document_id: null,
    status: 'pending',
    error_message: null,
    duration_ms: null,
    created_at: '2026-06-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('OperationDao', () => {
  let db: FakeDb;
  let dao: OperationDao;

  beforeEach(() => {
    db = new FakeDb();
    dao = new OperationDao(db);
  });

  it('create records a pending operation', async () => {
    db.onQuery(/FROM operations_history WHERE id/, [opRow()]);
    const op = await dao.create('merge', 'doc-1', '{"pages":2}');
    expect(op.status).toBe('pending');
    const insert = db.calls.find((c) =>
      c.sql.includes('INSERT INTO operations_history')
    );
    expect(insert?.sql).toContain("'pending'");
    expect(insert?.params).toContain('merge');
    expect(insert?.params).toContain('{"pages":2}');
  });

  it('create throws if the row cannot be read back', async () => {
    await expect(dao.create('split')).rejects.toThrow('did not persist');
  });

  it('updateStatus writes outcome fields', async () => {
    await dao.updateStatus('op-1', 'completed', {
      outputDocumentId: 'doc-2',
      durationMs: 320,
    });
    const update = db.calls[0];
    expect(update?.params).toEqual([
      'completed',
      'doc-2',
      null,
      320,
      'op-1',
    ]);
  });

  it('updateStatus handles failures with an error message', async () => {
    await dao.updateStatus('op-1', 'failed', { errorMessage: 'no pages' });
    expect(db.calls[0]?.params).toContain('no pages');
  });

  it('findByDocument matches source or output document', async () => {
    db.onQuery(/document_id = \? OR output_document_id = \?/, [opRow()]);
    const ops = await dao.findByDocument('doc-1');
    expect(ops[0]?.operationType).toBe('merge');
    expect(db.calls[0]?.params).toEqual(['doc-1', 'doc-1']);
  });

  it('findRecent binds the limit (default 50)', async () => {
    await dao.findRecent();
    expect(db.calls[0]?.params).toEqual([50]);
    await dao.findRecent(5);
    expect(db.calls[1]?.params).toEqual([5]);
  });

  it('findById returns null when missing', async () => {
    expect(await dao.findById('missing')).toBeNull();
  });
});
