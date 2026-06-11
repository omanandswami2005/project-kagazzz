import { describe, expect, it, vi } from 'vitest';
import type { LogRecord } from '../logger';
import { REDACTION_CENSOR } from '../redaction';
import {
  attachWorkerLogRelay,
  createWorkerLogger,
  isWorkerLogMessage,
  WORKER_LOG_MESSAGE_TYPE,
  type WorkerLogMessage,
} from '../worker-relay';

describe('createWorkerLogger (14-observability §9)', () => {
  it('posts redacted records tagged with module and opId', () => {
    const posted: WorkerLogMessage[] = [];
    const logger = createWorkerLogger('pdf-engine', (m) => posted.push(m), 'op-42');
    logger.info({ event: 'pdf.merge.start', fileCount: 2, password: 'x' });

    expect(posted).toHaveLength(1);
    expect(posted[0]?.type).toBe(WORKER_LOG_MESSAGE_TYPE);
    expect(posted[0]?.record).toMatchObject({
      module: 'pdf-engine',
      opId: 'op-42',
      event: 'pdf.merge.start',
      fileCount: 2,
      password: REDACTION_CENSOR,
    });
  });

  it('omits opId when not provided and suppresses debug', () => {
    const posted: WorkerLogMessage[] = [];
    const logger = createWorkerLogger('image-engine', (m) => posted.push(m));
    logger.debug({ event: 'noisy' });
    logger.info({ event: 'image.compress.success' });
    expect(posted).toHaveLength(1);
    expect(posted[0]?.record['opId']).toBeUndefined();
  });
});

describe('attachWorkerLogRelay', () => {
  function fakeWorker() {
    const listeners = new Set<(e: Event) => void>();
    return {
      addEventListener: vi.fn((_t: string, fn: EventListenerOrEventListenerObject) =>
        listeners.add(fn as (e: Event) => void)
      ),
      removeEventListener: vi.fn((_t: string, fn: EventListenerOrEventListenerObject) =>
        listeners.delete(fn as (e: Event) => void)
      ),
      emit(data: unknown) {
        for (const fn of listeners) {
          fn({ data } as unknown as Event);
        }
      },
    };
  }

  it('writes relayed records to the sink and ignores other messages', () => {
    const worker = fakeWorker();
    const records: LogRecord[] = [];
    attachWorkerLogRelay(worker, { write: (r) => records.push(r) });

    worker.emit({ type: WORKER_LOG_MESSAGE_TYPE, record: { event: 'a' } });
    worker.emit({ type: 'other', payload: 1 });
    worker.emit('garbage');

    expect(records).toEqual([{ event: 'a' }]);
  });

  it('returns an unsubscribe function', () => {
    const worker = fakeWorker();
    const records: LogRecord[] = [];
    const detach = attachWorkerLogRelay(worker, { write: (r) => records.push(r) });
    detach();
    worker.emit({ type: WORKER_LOG_MESSAGE_TYPE, record: { event: 'late' } });
    expect(records).toEqual([]);
    expect(worker.removeEventListener).toHaveBeenCalled();
  });
});

describe('isWorkerLogMessage', () => {
  it('guards the message shape', () => {
    expect(
      isWorkerLogMessage({ type: WORKER_LOG_MESSAGE_TYPE, record: {} })
    ).toBe(true);
    expect(isWorkerLogMessage({ type: 'x', record: {} })).toBe(false);
    expect(isWorkerLogMessage(null)).toBe(false);
    expect(isWorkerLogMessage('kagaz:log')).toBe(false);
  });
});
