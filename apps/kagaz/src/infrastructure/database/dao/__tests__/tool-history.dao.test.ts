import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import { MAX_TOOL_RUNS, ToolHistoryDao } from '../tool-history.dao';

describe('ToolHistoryDao', () => {
  let db: FakeDb;
  let dao: ToolHistoryDao;

  beforeEach(() => {
    db = new FakeDb();
    dao = new ToolHistoryDao(db);
  });

  it('records a run with id lists as JSON and prunes old rows', async () => {
    await dao.record({
      toolId: 'merge',
      inputDocumentIds: ['a', 'b'],
      outputDocumentIds: ['c'],
      status: 'completed',
      durationMs: 120,
    });
    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO operations_history'));
    expect(insert?.params.slice(1, 5)).toEqual(['merge', '["a","b"]', '["c"]', 'completed']);
    const prune = db.calls.find((c) => c.sql.includes('DELETE FROM operations_history WHERE id NOT IN'));
    expect(prune?.params).toEqual([MAX_TOOL_RUNS]);
  });

  it('maps rows back, filtering by tool when asked', async () => {
    db.onQuery(/WHERE tool_id = \?/, [
      {
        id: 'r1',
        tool_id: 'split',
        input_document_ids: '["a"]',
        output_document_ids: '["p1","p2"]',
        status: 'completed',
        error_code: null,
        duration_ms: 50,
        created_at: '2026-11-19T00:00:00.000Z',
      },
    ]);
    const runs = await dao.findRecent(10, 'split');
    expect(runs[0]).toMatchObject({ toolId: 'split', inputDocumentIds: ['a'], outputDocumentIds: ['p1', 'p2'] });
  });

  it('treats a corrupt id list as empty', async () => {
    db.onQuery(/ORDER BY created_at DESC LIMIT/, [
      {
        id: 'r1',
        tool_id: 'merge',
        input_document_ids: 'not json',
        output_document_ids: '[]',
        status: 'failed',
        error_code: 'INVALID_PDF',
        duration_ms: null,
        created_at: '2026-11-19T00:00:00.000Z',
      },
    ]);
    const [run] = await dao.findRecent();
    expect(run.inputDocumentIds).toEqual([]);
    expect(run.errorCode).toBe('INVALID_PDF');
  });
});
