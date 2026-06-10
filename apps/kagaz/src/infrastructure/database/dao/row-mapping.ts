/**
 * Strict row→entity coercion helpers shared by the DAOs.
 * SQLite rows arrive as `Record<string, unknown>`; these fail loudly on
 * schema drift instead of silently producing wrong shapes.
 */
import type { SqlRow } from '../connection';

/** Reads a required string column. */
export function asString(row: SqlRow, column: string): string {
  const v = row[column];
  if (typeof v !== 'string') {
    throw new Error(`Expected string in column "${column}", got ${typeof v}`);
  }
  return v;
}

/** Reads an optional (nullable) string column. */
export function asOptionalString(
  row: SqlRow,
  column: string
): string | undefined {
  const v = row[column];
  if (v === null || v === undefined) {
    return undefined;
  }
  if (typeof v !== 'string') {
    throw new Error(`Expected string in column "${column}", got ${typeof v}`);
  }
  return v;
}

/** Reads a required number column. */
export function asNumber(row: SqlRow, column: string): number {
  const v = row[column];
  if (typeof v !== 'number') {
    throw new Error(`Expected number in column "${column}", got ${typeof v}`);
  }
  return v;
}

/** Reads an optional (nullable) number column. */
export function asOptionalNumber(
  row: SqlRow,
  column: string
): number | undefined {
  const v = row[column];
  if (v === null || v === undefined) {
    return undefined;
  }
  if (typeof v !== 'number') {
    throw new Error(`Expected number in column "${column}", got ${typeof v}`);
  }
  return v;
}

/** Reads a 0/1 integer column as boolean (SQLite has no BOOLEAN type). */
export function asBool(row: SqlRow, column: string): boolean {
  const v = row[column];
  return v === 1 || v === true;
}

/** Generates a UUID v4 for new rows. */
export function newId(): string {
  return crypto.randomUUID();
}

/** Current timestamp in ISO 8601 (all *_at columns). */
export function nowIso(): string {
  return new Date().toISOString();
}
