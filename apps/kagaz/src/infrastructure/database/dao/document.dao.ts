/**
 * documents DAO (docs/architecture/09-database-design.md §4.1, §6, §8).
 * Owns all SQL for the documents table: CRUD with soft delete, optimistic
 * version bumps, and FTS5 search.
 */
import type { DbConnection, SqlRow, SqlValue } from '../connection';
import type { DocumentEntity, DocumentSourceType, NewDocument } from '../types';
import {
  asBool,
  asNumber,
  asOptionalString,
  asString,
  newId,
  nowIso,
} from './row-mapping';

function mapRow(row: SqlRow): DocumentEntity {
  return {
    id: asString(row, 'id'),
    name: asString(row, 'name'),
    description: asOptionalString(row, 'description'),
    filePath: asString(row, 'file_path'),
    fileType: asString(row, 'file_type'),
    fileSize: asNumber(row, 'file_size'),
    fileHash: asOptionalString(row, 'file_hash'),
    thumbnailPath: asOptionalString(row, 'thumbnail_path'),
    folderId: asOptionalString(row, 'folder_id'),
    isFavorite: asBool(row, 'is_favorite'),
    isLocked: asBool(row, 'is_locked'),
    isArchived: asBool(row, 'is_archived'),
    language: asString(row, 'language'),
    ocrText: asOptionalString(row, 'ocr_text'),
    sourceType: asString(row, 'source_type') as DocumentSourceType,
    originalFilename: asOptionalString(row, 'original_filename'),
    createdAt: asString(row, 'created_at'),
    updatedAt: asString(row, 'updated_at'),
    lastAccessedAt: asOptionalString(row, 'last_accessed_at'),
    deletedAt: asOptionalString(row, 'deleted_at'),
    metadataJson: asOptionalString(row, 'metadata_json'),
    synced: asBool(row, 'synced'),
    version: asNumber(row, 'version'),
  };
}

/** Typed access to the documents table. */
export class DocumentDao {
  constructor(private readonly db: DbConnection) {}

  /** Returns a non-deleted document by id, or null. */
  async findById(id: string): Promise<DocumentEntity | null> {
    const rows = await this.db.query(
      'SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  /**
   * Lists non-deleted documents in a folder (null = vault root),
   * newest first.
   */
  async findByFolder(folderId: string | null): Promise<DocumentEntity[]> {
    const sql = folderId
      ? `SELECT * FROM documents WHERE folder_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC`
      : `SELECT * FROM documents WHERE folder_id IS NULL AND deleted_at IS NULL
         ORDER BY created_at DESC`;
    const rows = await this.db.query(sql, folderId ? [folderId] : []);
    return rows.map(mapRow);
  }

  /** Total bytes + document count across the (non-deleted) vault (F-26). */
  async getStorageTotals(): Promise<{ totalBytes: number; count: number }> {
    const rows = await this.db.query(
      `SELECT COALESCE(SUM(file_size), 0) AS total, COUNT(*) AS n
       FROM documents WHERE deleted_at IS NULL`
    );
    return {
      totalBytes: asNumber(rows[0] ?? {}, 'total'),
      count: asNumber(rows[0] ?? {}, 'n'),
    };
  }

  /** Bytes + count grouped by file type, largest first (F-26). */
  async getUsageByType(): Promise<
    { fileType: string; bytes: number; count: number }[]
  > {
    const rows = await this.db.query(
      `SELECT file_type, SUM(file_size) AS bytes, COUNT(*) AS n
       FROM documents WHERE deleted_at IS NULL
       GROUP BY file_type ORDER BY bytes DESC`
    );
    return rows.map((row) => ({
      fileType: asString(row, 'file_type'),
      bytes: asNumber(row, 'bytes'),
      count: asNumber(row, 'n'),
    }));
  }

  /** The largest non-deleted documents (F-26). */
  async getLargestDocuments(limit = 10): Promise<DocumentEntity[]> {
    const rows = await this.db.query(
      `SELECT * FROM documents WHERE deleted_at IS NULL
       ORDER BY file_size DESC LIMIT ?`,
      [limit]
    );
    return rows.map(mapRow);
  }

  /** Counts duplicate groups (same file_hash) and their reclaimable bytes (F-26). */
  async getDuplicateStats(): Promise<{ groups: number; wastedBytes: number }> {
    const rows = await this.db.query(
      `SELECT file_hash, COUNT(*) AS n, MAX(file_size) AS size
       FROM documents
       WHERE deleted_at IS NULL AND file_hash IS NOT NULL
       GROUP BY file_hash HAVING n > 1`
    );
    let groups = 0;
    let wastedBytes = 0;
    for (const row of rows) {
      groups += 1;
      // Keeping one copy, the rest (n-1) are reclaimable.
      wastedBytes += (asNumber(row, 'n') - 1) * asNumber(row, 'size');
    }
    return { groups, wastedBytes };
  }

  /** Most-recently-opened non-deleted documents (F-32). */
  async findRecent(limit = 10): Promise<DocumentEntity[]> {
    const rows = await this.db.query(
      `SELECT * FROM documents
       WHERE last_accessed_at IS NOT NULL AND deleted_at IS NULL
       ORDER BY last_accessed_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(mapRow);
  }

  /** Stamps last_accessed_at = now for the "recent" list (F-32). */
  async touchLastAccessed(id: string): Promise<number> {
    const result = await this.db.run(
      `UPDATE documents SET last_accessed_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [nowIso(), id]
    );
    return result.changes;
  }

  /** Non-deleted favorites, newest first (F-33). */
  async findFavorites(): Promise<DocumentEntity[]> {
    const rows = await this.db.query(
      `SELECT * FROM documents
       WHERE is_favorite = 1 AND deleted_at IS NULL
       ORDER BY created_at DESC`
    );
    return rows.map(mapRow);
  }

  /** Inserts a new document and returns the stored row. */
  async create(doc: NewDocument): Promise<DocumentEntity> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO documents (id, name, description, file_path, file_type,
        file_size, file_hash, thumbnail_path, folder_id, is_favorite,
        is_locked, is_archived, language, ocr_text, source_type,
        original_filename, created_at, updated_at, metadata_json, synced,
        version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [
        id,
        doc.name,
        doc.description ?? null,
        doc.filePath,
        doc.fileType,
        doc.fileSize,
        doc.fileHash ?? null,
        doc.thumbnailPath ?? null,
        doc.folderId ?? null,
        doc.isFavorite ? 1 : 0,
        doc.isLocked ? 1 : 0,
        doc.isArchived ? 1 : 0,
        doc.language,
        doc.ocrText ?? null,
        doc.sourceType,
        doc.originalFilename ?? null,
        now,
        now,
        doc.metadataJson ?? null,
      ]
    );
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`documents insert for ${id} did not persist`);
    }
    return created;
  }

  /**
   * Updates mutable fields; bumps updated_at and the optimistic version.
   * Pass `null` to clear a nullable column (e.g. `folderId: null` moves the
   * document to the vault root). Returns affected rows (0 = not found).
   */
  async update(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      folderId?: string | null;
      isFavorite?: boolean;
      isLocked?: boolean;
      isArchived?: boolean;
      language?: string;
      ocrText?: string | null;
      thumbnailPath?: string | null;
      metadataJson?: string | null;
    }
  ): Promise<number> {
    const sets: string[] = [];
    const params: SqlValue[] = [];
    const push = (column: string, value: SqlValue): void => {
      sets.push(`${column} = ?`);
      params.push(value);
    };

    if (patch.name !== undefined) push('name', patch.name);
    if (patch.description !== undefined)
      push('description', patch.description ?? null);
    if (patch.folderId !== undefined) push('folder_id', patch.folderId ?? null);
    if (patch.isFavorite !== undefined)
      push('is_favorite', patch.isFavorite ? 1 : 0);
    if (patch.isLocked !== undefined) push('is_locked', patch.isLocked ? 1 : 0);
    if (patch.isArchived !== undefined)
      push('is_archived', patch.isArchived ? 1 : 0);
    if (patch.language !== undefined) push('language', patch.language);
    if (patch.ocrText !== undefined) push('ocr_text', patch.ocrText ?? null);
    if (patch.thumbnailPath !== undefined)
      push('thumbnail_path', patch.thumbnailPath ?? null);
    if (patch.metadataJson !== undefined)
      push('metadata_json', patch.metadataJson ?? null);

    if (sets.length === 0) {
      return 0;
    }
    push('updated_at', nowIso());
    params.push(id);
    const result = await this.db.run(
      `UPDATE documents SET ${sets.join(', ')}, version = version + 1
       WHERE id = ? AND deleted_at IS NULL`,
      params
    );
    return result.changes;
  }

  /** Soft-deletes a document (deleted_at timestamp, version bump). */
  async softDelete(id: string): Promise<number> {
    const now = nowIso();
    const result = await this.db.run(
      `UPDATE documents SET deleted_at = ?, updated_at = ?,
        version = version + 1 WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id]
    );
    return result.changes;
  }

  /** Restores a soft-deleted document. */
  async restore(id: string): Promise<number> {
    const result = await this.db.run(
      `UPDATE documents SET deleted_at = NULL, updated_at = ?,
        version = version + 1 WHERE id = ? AND deleted_at IS NOT NULL`,
      [nowIso(), id]
    );
    return result.changes;
  }

  /** FTS5 search across name/description/ocr_text (§6), rank order. */
  async search(query: string, limit = 20): Promise<DocumentEntity[]> {
    const rows = await this.db.query(
      `SELECT d.* FROM documents d
       JOIN documents_fts fts ON d.rowid = fts.rowid
       WHERE documents_fts MATCH ?
         AND d.deleted_at IS NULL
       ORDER BY rank
       LIMIT ?`,
      [query, limit]
    );
    return rows.map(mapRow);
  }
}
