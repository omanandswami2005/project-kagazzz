/**
 * operations_history DAO — PDF Tools run history (09-database-design §4.5,
 * migration 008). Append-only from the app's side; the oldest rows beyond
 * {@link MAX_TOOL_RUNS} are pruned on every insert.
 */
import type { DbConnection, SqlRow } from '../connection';
import type { ToolRunEntity, ToolRunStatus } from '../types';
import { asOptionalNumber, asOptionalString, asString, newId, nowIso } from './row-mapping';

/** History is a convenience, not an audit log: keep the latest runs only. */
export const MAX_TOOL_RUNS = 200;

function idList(row: SqlRow, column: string): string[] {
  try {
    const parsed: unknown = JSON.parse(asString(row, column));
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function mapRow(row: SqlRow): ToolRunEntity {
  return {
    id: asString(row, 'id'),
    toolId: asString(row, 'tool_id'),
    inputDocumentIds: idList(row, 'input_document_ids'),
    outputDocumentIds: idList(row, 'output_document_ids'),
    status: asString(row, 'status') as ToolRunStatus,
    errorCode: asOptionalString(row, 'error_code'),
    durationMs: asOptionalNumber(row, 'duration_ms'),
    createdAt: asString(row, 'created_at'),
  };
}

/** What a finished run records. */
export interface NewToolRun {
  toolId: string;
  inputDocumentIds: string[];
  outputDocumentIds: string[];
  status: ToolRunStatus;
  errorCode?: string;
  durationMs?: number;
}

/** Typed access to operations_history. */
export class ToolHistoryDao {
  constructor(private readonly db: DbConnection) {}

  /** Records a finished run and prunes history beyond {@link MAX_TOOL_RUNS}. */
  async record(run: NewToolRun): Promise<void> {
    await this.db.run(
      `INSERT INTO operations_history (id, tool_id, input_document_ids,
        output_document_ids, status, error_code, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        run.toolId,
        JSON.stringify(run.inputDocumentIds),
        JSON.stringify(run.outputDocumentIds),
        run.status,
        run.errorCode ?? null,
        run.durationMs ?? null,
        nowIso(),
      ]
    );
    await this.db.run(
      `DELETE FROM operations_history WHERE id NOT IN (
         SELECT id FROM operations_history ORDER BY created_at DESC LIMIT ?)`,
      [MAX_TOOL_RUNS]
    );
  }

  /** Latest runs, newest first; only one tool's when `toolId` is given. */
  async findRecent(limit = 50, toolId?: string): Promise<ToolRunEntity[]> {
    const rows = toolId
      ? await this.db.query(
          'SELECT * FROM operations_history WHERE tool_id = ? ORDER BY created_at DESC LIMIT ?',
          [toolId, limit]
        )
      : await this.db.query(
          'SELECT * FROM operations_history ORDER BY created_at DESC LIMIT ?',
          [limit]
        );
    return rows.map(mapRow);
  }

  /** Removes every run (the user's "clear history"). */
  async clear(): Promise<void> {
    await this.db.run('DELETE FROM operations_history');
  }
}
