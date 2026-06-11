/**
 * Diagnostic ring-buffer sink → app_logs
 * (docs/architecture/14-observability-logging.md §5).
 *
 * Batched writes (flush every 2 s or 50 records) — never synchronous
 * per-log I/O. Launch-time prune: 7 days / 5 MB, whichever first. Lives
 * inside the SQLCipher DB, so records are encrypted at rest.
 */
import type { DbConnection } from '@/infrastructure/database/connection';
import type { DiagnosticWriter, LogRecord } from './logger';

/** Tuning knobs (spec defaults). */
export interface DiagnosticSinkOptions {
  flushIntervalMs?: number;
  maxBatch?: number;
  retentionDays?: number;
  maxBytes?: number;
}

const PINO_LEVELS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/** Batched SQLite writer for the diagnostic stream. */
export class DiagnosticSink implements DiagnosticWriter {
  private readonly flushIntervalMs: number;
  private readonly maxBatch: number;
  private readonly retentionDays: number;
  private readonly maxBytes: number;
  private buffer: LogRecord[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly db: DbConnection,
    options: DiagnosticSinkOptions = {}
  ) {
    this.flushIntervalMs = options.flushIntervalMs ?? 2000;
    this.maxBatch = options.maxBatch ?? 50;
    this.retentionDays = options.retentionDays ?? 7;
    this.maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  }

  /** Queues a record; flushes when the batch is full. */
  write(record: LogRecord): void {
    this.buffer.push(record);
    if (this.buffer.length >= this.maxBatch) {
      void this.flush();
      return;
    }
    this.timer ??= setTimeout(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  /** Writes every buffered record to app_logs. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = this.buffer.splice(0);
    for (const record of batch) {
      const level = typeof record['level'] === 'string' ? record['level'] : 'info';
      await this.db.run(
        `INSERT INTO app_logs (time, level, module, event, record)
         VALUES (?, ?, ?, ?, ?)`,
        [
          typeof record['time'] === 'string'
            ? record['time']
            : new Date().toISOString(),
          PINO_LEVELS[level] ?? 30,
          typeof record['module'] === 'string' ? record['module'] : 'app',
          typeof record['event'] === 'string' ? record['event'] : '',
          JSON.stringify(record),
        ]
      );
    }
  }

  /**
   * Launch-time retention: drop rows older than the window, then enforce
   * the byte cap by deleting oldest rows.
   */
  async pruneOnLaunch(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000
    ).toISOString();
    await this.db.run('DELETE FROM app_logs WHERE time < ?', [cutoff]);

    for (let i = 0; i < 10; i += 1) {
      const rows = await this.db.query(
        'SELECT COALESCE(SUM(LENGTH(record)), 0) AS bytes FROM app_logs'
      );
      const bytes = rows[0]?.['bytes'];
      if (typeof bytes !== 'number' || bytes <= this.maxBytes) {
        return;
      }
      await this.db.run(
        `DELETE FROM app_logs WHERE id IN (
           SELECT id FROM app_logs ORDER BY id ASC LIMIT 200
         )`
      );
    }
  }
}
