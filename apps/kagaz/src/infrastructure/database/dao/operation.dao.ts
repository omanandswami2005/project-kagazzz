/**
 * operations_history DAO (docs/architecture/09-database-design.md §4.5).
 * Audit trail of document operations: created as pending, advanced via
 * status updates; never deleted in V1.
 */
import type { DbConnection, SqlRow } from '../connection';
import type {
  OperationEntity,
  OperationStatus,
  OperationType,
} from '../types';
import {
  asOptionalNumber,
  asOptionalString,
  asString,
  newId,
  nowIso,
} from './row-mapping';

function mapRow(row: SqlRow): OperationEntity {
  return {
    id: asString(row, 'id'),
    documentId: asOptionalString(row, 'document_id'),
    operationType: asString(row, 'operation_type') as OperationType,
    inputParamsJson: asOptionalString(row, 'input_params_json'),
    outputDocumentId: asOptionalString(row, 'output_document_id'),
    status: asString(row, 'status') as OperationStatus,
    errorMessage: asOptionalString(row, 'error_message'),
    durationMs: asOptionalNumber(row, 'duration_ms'),
    createdAt: asString(row, 'created_at'),
  };
}

/** Typed access to operations_history. */
export class OperationDao {
  constructor(private readonly db: DbConnection) {}

  /** Returns an operation by id, or null. */
  async findById(id: string): Promise<OperationEntity | null> {
    const rows = await this.db.query(
      'SELECT * FROM operations_history WHERE id = ?',
      [id]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  /** Records the start of an operation (status = pending). */
  async create(
    operationType: OperationType,
    documentId?: string,
    inputParamsJson?: string
  ): Promise<OperationEntity> {
    const id = newId();
    await this.db.run(
      `INSERT INTO operations_history (id, document_id, operation_type,
        input_params_json, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [id, documentId ?? null, operationType, inputParamsJson ?? null, nowIso()]
    );
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`operations_history insert for ${id} did not persist`);
    }
    return created;
  }

  /** Advances an operation's lifecycle status. */
  async updateStatus(
    id: string,
    status: OperationStatus,
    outcome?: {
      outputDocumentId?: string;
      errorMessage?: string;
      durationMs?: number;
    }
  ): Promise<number> {
    const result = await this.db.run(
      `UPDATE operations_history
       SET status = ?, output_document_id = ?, error_message = ?,
           duration_ms = ?
       WHERE id = ?`,
      [
        status,
        outcome?.outputDocumentId ?? null,
        outcome?.errorMessage ?? null,
        outcome?.durationMs ?? null,
        id,
      ]
    );
    return result.changes;
  }

  /** Lists operations touching a document (as source or output), newest first. */
  async findByDocument(documentId: string): Promise<OperationEntity[]> {
    const rows = await this.db.query(
      `SELECT * FROM operations_history
       WHERE document_id = ? OR output_document_id = ?
       ORDER BY created_at DESC`,
      [documentId, documentId]
    );
    return rows.map(mapRow);
  }

  /** Lists the most recent operations across all documents. */
  async findRecent(limit = 50): Promise<OperationEntity[]> {
    const rows = await this.db.query(
      'SELECT * FROM operations_history ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows.map(mapRow);
  }
}
