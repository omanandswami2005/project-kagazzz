import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import { DiagnosticSink } from '../diagnostic-sink';

describe('DiagnosticSink (14-observability §5)', () => {
  let db: FakeDb;
  let sink: DiagnosticSink;

  beforeEach(() => {
    vi.useFakeTimers();
    db = new FakeDb();
    sink = new DiagnosticSink(db, { flushIntervalMs: 2000, maxBatch: 3 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches writes until the flush interval elapses', async () => {
    sink.write({ time: 't', level: 'info', module: 'app', event: 'a' });
    expect(db.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]?.sql).toContain('INSERT INTO app_logs');
  });

  it('flushes immediately when the batch fills', async () => {
    for (let i = 0; i < 3; i += 1) {
      sink.write({ level: 'warn', module: 'auth', event: `e${i}` });
    }
    await vi.runAllTimersAsync();
    expect(db.calls.filter((c) => c.sql.includes('INSERT'))).toHaveLength(3);
  });

  it('maps pino level labels to numeric levels and serializes the record', async () => {
    sink.write({
      time: '2026-06-11T00:00:00.000Z',
      level: 'error',
      module: 'pdf-engine',
      event: 'pdf.merge.failed',
      opId: 'op-9',
    });
    await sink.flush();
    const insert = db.calls[0];
    expect(insert?.params?.[1]).toBe(50);
    expect(insert?.params?.[2]).toBe('pdf-engine');
    expect(insert?.params?.[3]).toBe('pdf.merge.failed');
    expect(insert?.params?.[4]).toContain('"opId":"op-9"');
  });

  it('defaults unknown level/module/event fields safely', async () => {
    sink.write({});
    await sink.flush();
    const insert = db.calls[0];
    expect(insert?.params?.[1]).toBe(30);
    expect(insert?.params?.[2]).toBe('app');
    expect(insert?.params?.[3]).toBe('');
  });

  it('pruneOnLaunch deletes old rows and enforces the byte cap', async () => {
    db.onQuery(/SUM\(LENGTH\(record\)\)/, [{ bytes: 6 * 1024 * 1024 }]);
    const small = new DiagnosticSink(db, { maxBytes: 5 * 1024 * 1024 });
    await small.pruneOnLaunch();
    const deletes = db.calls.filter((c) => c.sql.startsWith('DELETE'));
    expect(deletes[0]?.sql).toContain('WHERE time < ?');
    expect(deletes.some((c) => c.sql.includes('ORDER BY id ASC LIMIT 200'))).toBe(
      true
    );
  });

  it('pruneOnLaunch stops once under the cap', async () => {
    db.onQuery(/SUM\(LENGTH\(record\)\)/, [{ bytes: 1024 }]);
    await sink.pruneOnLaunch();
    const capDeletes = db.calls.filter((c) => c.sql.includes('LIMIT 200'));
    expect(capDeletes).toHaveLength(0);
  });
});
