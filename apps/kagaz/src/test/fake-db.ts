/**
 * In-memory fake of the DbConnection protocol for unit tests.
 * Records every statement and serves canned query results by SQL pattern.
 */
import type {
  DbConnection,
  RunResult,
  SqlRow,
  SqlValue,
} from '@/infrastructure/database/connection';

/** One recorded statement. */
export interface DbCall {
  kind: 'query' | 'run' | 'execute';
  sql: string;
  params: SqlValue[];
}

/** Test double for DbConnection. */
export class FakeDb implements DbConnection {
  /** Every statement in execution order. */
  readonly calls: DbCall[] = [];
  /** Transaction lifecycle counters. */
  transactions = 0;
  commits = 0;
  rollbacks = 0;
  /** Value returned as `changes` from run(). */
  runChanges = 1;

  private readonly handlers: Array<{ match: RegExp; rows: SqlRow[] }> = [];

  /** Serves `rows` for any query whose SQL matches `pattern`. */
  onQuery(pattern: RegExp | string, rows: SqlRow[]): this {
    const match =
      typeof pattern === 'string'
        ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        : pattern;
    this.handlers.push({ match, rows });
    return this;
  }

  /** SQL of all recorded statements joined (for contains-assertions). */
  get allSql(): string {
    return this.calls.map((c) => c.sql).join('\n');
  }

  query(sql: string, params: SqlValue[] = []): Promise<SqlRow[]> {
    this.calls.push({ kind: 'query', sql, params });
    const handler = this.handlers.find((h) => h.match.test(sql));
    return Promise.resolve(handler ? handler.rows : []);
  }

  run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    this.calls.push({ kind: 'run', sql, params });
    return Promise.resolve({ changes: this.runChanges });
  }

  execute(sql: string): Promise<void> {
    this.calls.push({ kind: 'execute', sql, params: [] });
    return Promise.resolve();
  }

  async transaction<T>(fn: (tx: DbConnection) => Promise<T>): Promise<T> {
    this.transactions += 1;
    try {
      const result = await fn(this);
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}
