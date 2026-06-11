/**
 * Worker → main-thread log relay
 * (docs/architecture/14-observability-logging.md §9).
 *
 * Workers never write to SQLite (single-writer rule): worker-side loggers
 * post records to the main thread; the main-thread relay feeds them into
 * the diagnostic sink with module + opId intact, so one operation reads
 * as a single correlated trace across threads.
 */
// eslint-disable-next-line import-x/no-named-as-default -- documented pino API
import pino, { type Logger } from 'pino';
import { logEventToRecord, type DiagnosticWriter, type LogRecord } from './logger';
import { redactRecord } from './redaction';

/** Message discriminator for relayed log records. */
export const WORKER_LOG_MESSAGE_TYPE = 'kagaz:log';

/** Envelope a worker posts for each record. */
export interface WorkerLogMessage {
  type: typeof WORKER_LOG_MESSAGE_TYPE;
  record: LogRecord;
}

/** Type guard for relayed log messages. */
export function isWorkerLogMessage(data: unknown): data is WorkerLogMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === WORKER_LOG_MESSAGE_TYPE &&
    typeof (data as { record?: unknown }).record === 'object'
  );
}

/**
 * Creates the pino logger used INSIDE a worker. Records are redacted in
 * the worker (defense in depth) and posted to the main thread.
 *
 * @param module - worker module tag (e.g. 'pdf-engine')
 * @param post - the worker's postMessage
 * @param opId - operation id correlating the UI → worker → UI trace
 */
export function createWorkerLogger(
  module: string,
  post: (message: WorkerLogMessage) => void,
  opId?: string
): Logger {
  // Base bindings are not part of pino's browser logEvent — merged into
  // each posted record below.
  const base = { app: 'kagaz', module, ...(opId ? { opId } : {}) };
  return pino({
    level: 'info',
    base,
    browser: {
      asObject: true,
      write: () => {
        // Worker console output is intentionally suppressed; the record
        // reaches the dev console via the main-thread stream.
      },
      transmit: {
        level: 'info',
        send: (_level, logEvent) => {
          post({
            type: WORKER_LOG_MESSAGE_TYPE,
            record: redactRecord({ ...base, ...logEventToRecord(logEvent) }),
          });
        },
      },
    },
  });
}

/**
 * Main-thread side: pipes a worker's relayed records into the diagnostic
 * sink. Returns an unsubscribe function (call when the worker is
 * disposed).
 */
export function attachWorkerLogRelay(
  worker: Pick<Worker, 'addEventListener' | 'removeEventListener'>,
  sink: DiagnosticWriter
): () => void {
  const onMessage = (event: Event): void => {
    const data = (event as MessageEvent).data as unknown;
    if (isWorkerLogMessage(data)) {
      sink.write(data.record);
    }
  };
  worker.addEventListener('message', onMessage);
  return () => worker.removeEventListener('message', onMessage);
}
