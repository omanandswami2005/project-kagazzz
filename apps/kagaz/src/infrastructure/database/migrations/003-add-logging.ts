/**
 * Migration 003 — logging tables
 * (docs/architecture/14-observability-logging.md §5–§6).
 *
 * app_logs: diagnostic ring buffer (7-day/5MB, pruned by DiagnosticSink).
 * audit_logs: append-only, hash-chained legal evidence (consent, shares,
 * destructive ops) — 2-year retention, never rotated away.
 * Immutable once shipped.
 */
import type { Migration } from '../migration-runner';

const DDL = `
CREATE TABLE IF NOT EXISTS app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL,
  level INTEGER NOT NULL,
  module TEXT NOT NULL,
  event TEXT NOT NULL,
  record TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_logs_time ON app_logs(time);

CREATE TABLE IF NOT EXISTS audit_logs (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT,
  request_id TEXT,
  ua TEXT,
  record_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL
);`;

const DROP_DDL = `
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS app_logs;`;

/** Diagnostic ring buffer + hash-chained audit log tables. */
export const addLogging: Migration = {
  version: 3,
  name: 'add-logging',
  up: async (db) => {
    await db.execute(DDL);
  },
  down: async (db) => {
    await db.execute(DROP_DDL);
  },
};
