import { afterEach, describe, expect, it } from 'vitest';
import {
  createRootLogger,
  log,
  logEventToRecord,
  setDiagnosticSink,
  type LogRecord,
} from '../logger';
import { REDACTION_CENSOR } from '../redaction';

afterEach(() => {
  setDiagnosticSink(null);
});

function captureSink(): { records: LogRecord[]; write: (r: LogRecord) => void } {
  const records: LogRecord[] = [];
  return { records, write: (r) => records.push(r) };
}

describe('rootLogger / log(module)', () => {
  it('transmits structured records with app/version/module bindings', () => {
    const sink = captureSink();
    setDiagnosticSink(sink);
    const logger = createRootLogger({ dev: false, appVersion: '1.2.3' });
    logger.child({ module: 'pdf-engine' }).info({
      event: 'pdf.merge.start',
      opId: 'op-1',
      fileCount: 3,
    });
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({
      app: 'kagaz',
      v: '1.2.3',
      module: 'pdf-engine',
      event: 'pdf.merge.start',
      opId: 'op-1',
      fileCount: 3,
      level: 'info',
    });
  });

  it('redacts denylisted fields before they reach the sink', () => {
    const sink = captureSink();
    setDiagnosticSink(sink);
    const logger = createRootLogger({ dev: false });
    logger.info({ event: 'auth.pin.set', pin: '1234', nested: { key: 'k' } });
    expect(sink.records[0]?.['pin']).toBe(REDACTION_CENSOR);
    expect((sink.records[0]?.['nested'] as LogRecord)['key']).toBe(
      REDACTION_CENSOR
    );
  });

  it('queues records until a sink attaches, then flushes in order', () => {
    const logger = createRootLogger({ dev: false });
    logger.info({ event: 'one' });
    logger.info({ event: 'two' });
    const sink = captureSink();
    setDiagnosticSink(sink);
    expect(sink.records.map((r) => r['event'])).toEqual(['one', 'two']);
  });

  it('does not transmit debug records (transmit level = info)', () => {
    const sink = captureSink();
    setDiagnosticSink(sink);
    const logger = createRootLogger({ dev: true });
    logger.debug({ event: 'noisy.thing' });
    expect(sink.records).toHaveLength(0);
  });

  it('log(module) returns a child bound to the module', () => {
    const sink = captureSink();
    setDiagnosticSink(sink);
    log('document-vault').warn({ event: 'vault.quota.near' });
    expect(sink.records[0]?.['module']).toBe('document-vault');
  });
});

describe('logEventToRecord', () => {
  it('merges bindings and object/string messages', () => {
    const record = logEventToRecord({
      ts: Date.UTC(2026, 5, 11, 10, 0, 0),
      level: { label: 'error' },
      bindings: [{ app: 'kagaz' }, { module: 'auth' }],
      messages: [{ event: 'auth.biometric.failed' }, 'lock engaged'],
    });
    expect(record).toMatchObject({
      level: 'error',
      app: 'kagaz',
      module: 'auth',
      event: 'auth.biometric.failed',
      msg: 'lock engaged',
    });
    expect(record['time']).toBe('2026-06-11T10:00:00.000Z');
  });
});
