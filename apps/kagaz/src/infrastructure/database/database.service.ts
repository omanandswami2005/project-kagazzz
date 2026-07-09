/**
 * Encrypted SQLite database lifecycle
 * (docs/architecture/09-database-design.md §2, 10-security-architecture.md §3.2).
 *
 * Owns the single `@capacitor-community/sqlite` connection for the app,
 * opens it SQLCipher-encrypted with the key from secure storage, runs
 * pending migrations, and exposes the connection behind the
 * {@link DbConnection} protocol so nothing else touches the plugin.
 */
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { DbConnection, RunResult, SqlRow, SqlValue } from './connection';
import { getOrCreateDbEncryptionKey } from './encryption-key.provider';
import { runMigrations, type Migration } from './migration-runner';
import { migrations as registry } from './migrations';

/** Database file name (kagaz.db on device). */
export const DATABASE_NAME = 'kagaz';

/** Adapts a plugin connection to the {@link DbConnection} protocol. */
export class SqliteDbAdapter implements DbConnection {
  constructor(private readonly db: SQLiteDBConnection) {}

  async query(sql: string, params: SqlValue[] = []): Promise<SqlRow[]> {
    const result = await this.db.query(sql, params);
    // The plugin types `values` as any[]; rows are objects keyed by column.
    return (result.values ?? []) as SqlRow[];
  }

  async run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    // Last arg disables the plugin's per-statement implicit transaction;
    // transactional scope is owned by transaction().
    const result = await this.db.run(sql, params, false);
    return { changes: result.changes?.changes ?? 0 };
  }

  async execute(sql: string): Promise<void> {
    // The native plugin batch-splits DDL on ";\n" and only folds a
    // trailing `END;` into its CREATE TRIGGER when that `END;` is
    // newline-terminated (UtilsSQLite.concatRemoveEnd matches the bare
    // token "END", not "END;"). A DDL ending in `END;` with no trailing
    // newline therefore leaves the last trigger unclosed and the whole
    // migration aborts with "incomplete input". Guaranteeing a trailing
    // newline here makes every migration splitter-safe regardless of its
    // own formatting. (Trigger bodies must still be single-statement —
    // a separate native-splitter constraint enforced by migrations.test.)
    const normalized = sql.endsWith('\n') ? sql : `${sql}\n`;
    await this.db.execute(normalized, false);
  }

  async transaction<T>(fn: (tx: DbConnection) => Promise<T>): Promise<T> {
    await this.db.execute('BEGIN TRANSACTION;', false);
    try {
      const result = await fn(this);
      await this.db.execute('COMMIT;', false);
      return result;
    } catch (error) {
      await this.db.execute('ROLLBACK;', false);
      throw error;
    }
  }
}

/**
 * Opens (creating + migrating if needed) the encrypted app database.
 *
 * @param migrations - migration registry (defaults to the app registry;
 *   injectable for tests)
 * @param onMigrationApplied - optional hook forwarded to the runner
 */
export async function openDatabase(
  migrations: Migration[] = registry,
  onMigrationApplied?: (migration: Migration) => void
): Promise<DbConnection> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  if (Capacitor.getPlatform() === 'web') {
    // Web fallback requires the jeep-sqlite custom element + wasm store.
    await sqlite.initWebStore();
  }

  const encryptionKey = await getOrCreateDbEncryptionKey();
  await sqlite.isSecretStored().then(async ({ result }) => {
    if (!result) {
      await sqlite.setEncryptionSecret(encryptionKey);
    }
  });

  const db = await sqlite.createConnection(
    DATABASE_NAME,
    true,
    'secret',
    1,
    false
  );
  await db.open();

  const connection = new SqliteDbAdapter(db);
  await runMigrations(connection, migrations, onMigrationApplied);
  return connection;
}

/**
 * Deletes the encrypted database file (SEC-V1 §8 #12 full data erasure). Must
 * run while the SQLCipher secret is still active (i.e. before the secure-storage
 * key is removed) — otherwise the encrypted file can't be opened to delete it.
 * Best-effort: resolves even if there is nothing to delete.
 */
export async function deleteDatabase(): Promise<void> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const { result: isConn } = await sqlite.isConnection(DATABASE_NAME, false);
  const db = isConn
    ? await sqlite.retrieveConnection(DATABASE_NAME, false)
    : await sqlite.createConnection(DATABASE_NAME, true, 'secret', 1, false);
  await db.delete();
  await sqlite.closeConnection(DATABASE_NAME, false).catch(() => undefined);
}
