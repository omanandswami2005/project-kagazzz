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

  // Cached across calls on this instance — `hasFts()` is called on every
  // keystroke's search via useSearch, and the answer never changes for the
  // lifetime of a connection (§6, and the fallback note on `search()` below).
  private ftsAvailable: boolean | null = null;

  /**
   * Whether `documents_fts` exists. Some Android SQLCipher builds omit the
   * FTS5 module at runtime even when the DDL is well-formed ("no such
   * module: fts5" — a known gap, not specific to this app); migration 002
   * catches that and skips creating the table rather than failing the whole
   * migration chain, so its absence is a real, on-device possibility to
   * check for, not just a defensive test case.
   */
  private async hasFts(): Promise<boolean> {
    if (this.ftsAvailable === null) {
      const rows = await this.db.query(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'documents_fts'"
      );
      this.ftsAvailable = rows.length > 0;
    }
    return this.ftsAvailable;
  }

  /** Returns a non-deleted document by id, or null. */
  async findById(id: string): Promise<DocumentEntity | null> {
    const rows = await this.db.query(
      'SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  /**
   * Lists non-deleted, non-archived documents in a folder (null = vault
   * root), newest first — the main browsing list (F-89: archived
   * documents are deliberately excluded here, the same way trashed ones
   * already are, but stay visible via `findArchived`/Search/Favorites).
   */
  async findByFolder(folderId: string | null): Promise<DocumentEntity[]> {
    const sql = folderId
      ? `SELECT * FROM documents
         WHERE folder_id = ? AND deleted_at IS NULL AND is_archived = 0
         ORDER BY created_at DESC`
      : `SELECT * FROM documents
         WHERE folder_id IS NULL AND deleted_at IS NULL AND is_archived = 0
         ORDER BY created_at DESC`;
    const rows = await this.db.query(sql, folderId ? [folderId] : []);
    return rows.map(mapRow);
  }

  /**
   * Lists every non-deleted document across all folders, newest first.
   * Used by the encrypted-backup export (SEC-V1 §8 #11 / F-31).
   */
  async findAll(): Promise<DocumentEntity[]> {
    const rows = await this.db.query(
      'SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );
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

  /**
   * Most-recently-opened non-deleted, non-archived documents (F-32).
   * Archived documents are excluded (F-89) — Recent is a shortcut back
   * into the active working set, and a document the user just deliberately
   * archived shouldn't immediately resurface there.
   */
  async findRecent(limit = 10): Promise<DocumentEntity[]> {
    const rows = await this.db.query(
      `SELECT * FROM documents
       WHERE last_accessed_at IS NOT NULL AND deleted_at IS NULL
         AND is_archived = 0
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

  /**
   * Lists soft-deleted documents (the Trash, F-57), most-recently-deleted
   * first. These are hidden from every other query by the `deleted_at IS NULL`
   * filter; this is the only view that surfaces them.
   */
  async findTrashed(): Promise<DocumentEntity[]> {
    const rows = await this.db.query(
      `SELECT * FROM documents WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`
    );
    return rows.map(mapRow);
  }

  /**
   * Lists archived, non-deleted documents (F-89), most-recently-updated
   * first. Archiving only hides a document from the main browsing list and
   * Recent (`findByFolder`/`findRecent`) — unlike Trash, it's still fully
   * counted in storage stats, still returned by `search()`/`findFavorites`,
   * and still included in `findAll()`'s backup export. This is the only
   * view that filters *to* `is_archived = 1`.
   */
  async findArchived(): Promise<DocumentEntity[]> {
    const rows = await this.db.query(
      `SELECT * FROM documents WHERE deleted_at IS NULL AND is_archived = 1
       ORDER BY updated_at DESC`
    );
    return rows.map(mapRow);
  }

  /**
   * Permanently removes a document row (F-57). Guarded to trashed rows only, so
   * a live document can never be hard-deleted without first going to Trash. The
   * caller is responsible for deleting the associated files.
   */
  async hardDelete(id: string): Promise<number> {
    const result = await this.db.run(
      'DELETE FROM documents WHERE id = ? AND deleted_at IS NOT NULL',
      [id]
    );
    return result.changes;
  }

  /**
   * FTS5 search across name/description/ocr_text (§6), rank order, UNIONed
   * with a plain `LIKE` substring scan and deduplicated.
   *
   * FTS5's `unicode61` tokenizer only supports *prefix* queries (`token*`
   * matches a token starting with "token") — it cannot match a substring
   * that starts mid-token. That silently breaks very ordinary searches: a
   * compound filename like "AadharCard.pdf" tokenizes as one token
   * "aadharcard", so searching "card" (real, common bug report — matches
   * neither the filename nor a mid-word OCR hit) returns nothing via FTS5
   * alone even though the term is plainly *in* the document. The `LIKE
   * '%term%'` scan (already required as the no-FTS5 fallback, see
   * {@link hasFts}) is substring-correct by construction, so running it
   * alongside FTS5 — FTS5 results first for relevance ranking, then any
   * additional substring-only matches — gets both correctness and (for the
   * common prefix case) ranking, without depending on a trigram tokenizer
   * this SQLite/SQLCipher build may not have compiled in.
   *
   * `query` is the already-built FTS5 match string from `buildFtsMatchQuery`
   * (e.g. `"aadh* card*"`); the LIKE scan re-derives its tokens from it
   * rather than taking raw input, so callers don't need a second code path.
   */
  async search(query: string, limit = 20): Promise<DocumentEntity[]> {
    if (!(await this.hasFts())) {
      return this.searchByLike(query, limit);
    }
    const ftsRows = await this.db.query(
      `SELECT d.* FROM documents d
       JOIN documents_fts fts ON d.rowid = fts.rowid
       WHERE documents_fts MATCH ?
         AND d.deleted_at IS NULL
       ORDER BY rank
       LIMIT ?`,
      [query, limit]
    );
    const ftsMatches = ftsRows.map(mapRow);
    if (ftsMatches.length >= limit) {
      return ftsMatches;
    }
    const likeMatches = await this.searchByLike(query, limit);
    const seen = new Set(ftsMatches.map((doc) => doc.id));
    const merged = ftsMatches.concat(likeMatches.filter((doc) => !seen.has(doc.id)));
    return merged.slice(0, limit);
  }

  /** Substring `LIKE` scan across name/description/ocr_text — see {@link search}. */
  private async searchByLike(
    query: string,
    limit: number
  ): Promise<DocumentEntity[]> {
    const tokens = query
      .split(' ')
      .map((token) => token.replace(/\*$/, ''))
      .filter((token) => token.length > 0);
    if (tokens.length === 0) {
      return [];
    }
    const perToken = tokens.map(
      () => '(name LIKE ? OR description LIKE ? OR ocr_text LIKE ?)'
    );
    const params: SqlValue[] = tokens.flatMap((token) => {
      const pattern = `%${token}%`;
      return [pattern, pattern, pattern];
    });
    const rows = await this.db.query(
      `SELECT * FROM documents
       WHERE deleted_at IS NULL
         AND ${perToken.join(' AND ')}
       ORDER BY updated_at DESC
       LIMIT ?`,
      [...params, limit]
    );
    return rows.map(mapRow);
  }
}
