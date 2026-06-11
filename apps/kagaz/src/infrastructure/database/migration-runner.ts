/**
 * Versioned, incremental migration runner
 * (docs/architecture/09-database-design.md §7).
 *
 * Rules enforced here:
 * - migrations run strictly in ascending `version` order;
 * - each migration runs inside a transaction (atomic — partial migrations
 *   would corrupt user vaults);
 * - applied versions are recorded in `_migrations` and never re-run;
 * - shipped migrations are immutable — fixes are new migrations.
 */
import type { DbConnection } from './connection';

/** A single schema migration. Shipped migrations must never change. */
export interface Migration {
  /** Monotonically increasing schema version (1, 2, 3, …). */
  version: number;
  /** Human-readable name recorded in `_migrations`. */
  name: string;
  /** Applies the migration. */
  up: (db: DbConnection) => Promise<void>;
  /** Reverts the migration (development/rollback aid). */
  down: (db: DbConnection) => Promise<void>;
}

const MIGRATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS _migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
);`;

/** Returns the highest applied schema version (0 = pristine database). */
export async function getCurrentVersion(db: DbConnection): Promise<number> {
  await db.execute(MIGRATIONS_TABLE_DDL);
  const rows = await db.query('SELECT MAX(version) AS v FROM _migrations');
  const v = rows[0]?.['v'];
  return typeof v === 'number' ? v : 0;
}

/**
 * Applies every migration newer than the current schema version, in order.
 *
 * @param db - open database connection
 * @param migrations - full registry (any order; duplicates are an error)
 * @param onApplied - optional hook per applied migration (used for logging
 *   by the caller — this module itself never logs)
 * @returns versions that were applied in this run
 */
export async function runMigrations(
  db: DbConnection,
  migrations: Migration[],
  onApplied?: (migration: Migration) => void
): Promise<number[]> {
  const versions = new Set<number>();
  for (const m of migrations) {
    if (versions.has(m.version)) {
      throw new Error(`Duplicate migration version: ${m.version}`);
    }
    versions.add(m.version);
  }

  const currentVersion = await getCurrentVersion(db);
  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  const applied: number[] = [];
  for (const migration of pending) {
    try {
      await db.transaction(async (tx) => {
        await migration.up(tx);
        await tx.run(
          'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.name, new Date().toISOString()]
        );
      });
    } catch (error) {
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${String(error)}`,
        { cause: error }
      );
    }
    applied.push(migration.version);
    onApplied?.(migration);
  }
  return applied;
}
