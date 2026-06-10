/**
 * Database connection protocol.
 *
 * All DAOs and the migration runner depend on this minimal interface —
 * never on `@capacitor-community/sqlite` directly — so they can be unit
 * tested with an in-memory fake and the engine can be swapped per platform
 * (protocol-based design, docs/architecture/01-system-architecture.md).
 */

/** Values SQLite can bind as statement parameters. */
export type SqlValue = string | number | null;

/** A single result row keyed by column name. */
export type SqlRow = Record<string, unknown>;

/** Result of a mutating statement. */
export interface RunResult {
  /** Number of rows inserted/updated/deleted. */
  changes: number;
}

/**
 * Minimal async connection contract implemented by the SQLite adapter
 * (and by test fakes).
 */
export interface DbConnection {
  /** Run a SELECT and return all rows. */
  query(sql: string, params?: SqlValue[]): Promise<SqlRow[]>;

  /** Run a single INSERT/UPDATE/DELETE with bound parameters. */
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;

  /**
   * Execute one or more semicolon-separated statements (DDL etc.).
   * Implementations must NOT wrap this in an implicit transaction —
   * transactional boundaries belong to {@link DbConnection.transaction}.
   */
  execute(sql: string): Promise<void>;

  /**
   * Run `fn` inside a BEGIN/COMMIT transaction, rolling back if it throws.
   * Nested transactions are not supported.
   */
  transaction<T>(fn: (tx: DbConnection) => Promise<T>): Promise<T>;
}
