/**
 * Root + module child loggers
 * (docs/architecture/14-observability-logging.md §3–§4).
 *
 * Three streams: dev console (dev builds only), diagnostic ring buffer
 * (via the pluggable sink), audit (separate DAO — never through pino).
 * Every record passes the central redaction before leaving this module.
 */
// pino's default-export factory is the documented API.
// eslint-disable-next-line import-x/no-named-as-default
import pino, { type Logger } from 'pino';
import { redactRecord } from './redaction';

/** Module names usable as child-logger context (matches commit scopes). */
export type ModuleName =
  | 'app'
  | 'core'
  | 'database'
  | 'filesystem'
  | 'document-vault'
  | 'document-scanner'
  | 'pdf-engine'
  | 'image-engine'
  | 'ai-assistant'
  | 'search'
  | 'settings'
  | 'auth'
  | 'sharing'
  | 'cloud-sync'
  | 'csc-services'
  | 'worker';

/** A structured, post-redaction log record. */
export type LogRecord = Record<string, unknown>;

/** Anything that can persist diagnostic records (the SQLite ring buffer). */
export interface DiagnosticWriter {
  write(record: LogRecord): void;
}

interface PendingState {
  sink: DiagnosticWriter | null;
  queue: LogRecord[];
}

const MAX_QUEUE = 200;

const state: PendingState = { sink: null, queue: [] };

/**
 * Attaches the diagnostic sink (created once the encrypted DB is open).
 * Records logged before attachment are queued (bounded) and flushed.
 */
export function setDiagnosticSink(sink: DiagnosticWriter | null): void {
  state.sink = sink;
  if (sink) {
    for (const record of state.queue.splice(0)) {
      sink.write(record);
    }
  }
}

/** Converts a pino browser logEvent into one flat record. */
export function logEventToRecord(logEvent: {
  ts: number;
  level: { label: string };
  messages: unknown[];
  bindings: unknown[];
}): LogRecord {
  const record: LogRecord = {
    time: new Date(logEvent.ts).toISOString(),
    level: logEvent.level.label,
  };
  for (const binding of logEvent.bindings) {
    if (binding && typeof binding === 'object') {
      Object.assign(record, binding);
    }
  }
  for (const message of logEvent.messages) {
    if (message && typeof message === 'object') {
      Object.assign(record, message);
    } else if (typeof message === 'string') {
      record['msg'] = message;
    }
  }
  return record;
}

function isDev(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function buildAppVersion(): string | undefined {
  // Injected from package.json by vite.config.ts's `define` — see its
  // comment for why this replaced a `VITE_APP_VERSION` env var nothing
  // ever actually set. `typeof` (not a direct reference) so this stays
  // safe under Vitest, which doesn't define this build-time global.
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined;
}

/** App version stamped on every record. */
export const APP_VERSION: string = buildAppVersion() ?? '0.0.0-dev';

/**
 * Creates the root logger. Exported for tests; the app uses the
 * {@link rootLogger} singleton.
 */
export function createRootLogger(
  options: { dev?: boolean; appVersion?: string } = {}
): Logger {
  const dev = options.dev ?? isDev();
  // pino's browser logEvent does NOT carry `base` bindings — merge them
  // into transmitted records explicitly.
  const base = { app: 'kagaz', v: options.appVersion ?? APP_VERSION };
  return pino({
    level: dev ? 'debug' : 'info',
    base,
    browser: {
      asObject: true,
      // Dev stream: redacted records as expandable console objects.
      // Production builds keep the console silent (diagnostic sink only).
      write: (o) => {
        if (dev) {
          console.warn(redactRecord(o));
        }
      },
      transmit: {
        level: 'info',
        send: (_level, logEvent) => {
          const record = redactRecord({
            ...base,
            ...logEventToRecord(logEvent),
          });
          if (state.sink) {
            state.sink.write(record);
          } else if (state.queue.length < MAX_QUEUE) {
            state.queue.push(record);
          }
        },
      },
    },
  });
}

/** The app-wide root logger. */
export const rootLogger: Logger = createRootLogger();

/**
 * Returns the child logger for a module — module context is mandatory
 * on every record (§4).
 */
export function log(module: ModuleName): Logger {
  return rootLogger.child({ module });
}
