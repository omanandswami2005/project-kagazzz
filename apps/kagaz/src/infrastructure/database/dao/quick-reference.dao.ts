/**
 * quick_reference_entries + quick_reference_tags DAO
 * (docs/architecture/09-database-design.md §4.12, F-84). `label` is always
 * user-typed free text — see 10-security-architecture.md §3.6 for why the
 * schema/DAO never interpret it.
 */
import type { DbConnection, SqlRow, SqlValue } from '../connection';
import type { QuickReferenceEntry, TagEntity } from '../types';
import { asBool, asOptionalString, asString, newId, nowIso } from './row-mapping';

function mapRow(row: SqlRow): QuickReferenceEntry {
  return {
    id: asString(row, 'id'),
    label: asString(row, 'label'),
    value: asString(row, 'value'),
    linkedDocumentId: asOptionalString(row, 'linked_document_id'),
    isSecure: asBool(row, 'is_secure'),
    createdAt: asString(row, 'created_at'),
    updatedAt: asString(row, 'updated_at'),
  };
}

function mapTagRow(row: SqlRow): TagEntity {
  return {
    id: asString(row, 'id'),
    name: asString(row, 'name'),
    color: asOptionalString(row, 'color'),
    createdAt: asString(row, 'created_at'),
  };
}

/** Typed access to quick_reference_entries and its tag junction. */
export class QuickReferenceDao {
  constructor(private readonly db: DbConnection) {}

  /** Returns an entry by id, or null. */
  async findById(id: string): Promise<QuickReferenceEntry | null> {
    const rows = await this.db.query(
      'SELECT * FROM quick_reference_entries WHERE id = ?',
      [id]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  /** Lists entries, most recently updated first. `isSecure` filters to just
   * the Quick Reference (true) or Quick Notes (false) board; omit for both. */
  async findAll(isSecure?: boolean): Promise<QuickReferenceEntry[]> {
    if (isSecure === undefined) {
      const rows = await this.db.query(
        'SELECT * FROM quick_reference_entries ORDER BY updated_at DESC'
      );
      return rows.map(mapRow);
    }
    const rows = await this.db.query(
      'SELECT * FROM quick_reference_entries WHERE is_secure = ? ORDER BY updated_at DESC',
      [isSecure ? 1 : 0]
    );
    return rows.map(mapRow);
  }

  /** Lists entries linked to a document (provenance lookup). */
  async findByDocument(documentId: string): Promise<QuickReferenceEntry[]> {
    const rows = await this.db.query(
      `SELECT * FROM quick_reference_entries
       WHERE linked_document_id = ?
       ORDER BY updated_at DESC`,
      [documentId]
    );
    return rows.map(mapRow);
  }

  /** Creates an entry. `label`/`value` are stored verbatim, untyped.
   * `isSecure` picks which board it belongs to (default true — secure by
   * default, same posture as the Quick Reference lock toggle's own default). */
  async create(
    label: string,
    value: string,
    isSecure = true,
    linkedDocumentId?: string
  ): Promise<QuickReferenceEntry> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO quick_reference_entries
         (id, label, value, linked_document_id, is_secure, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, label, value, linkedDocumentId ?? null, isSecure ? 1 : 0, now, now]
    );
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`quick_reference_entries insert for ${id} did not persist`);
    }
    return created;
  }

  /** Updates label/value; only the given fields change. */
  async update(
    id: string,
    patch: { label?: string; value?: string }
  ): Promise<number> {
    const sets: string[] = [];
    const params: SqlValue[] = [];
    const push = (column: string, value: SqlValue): void => {
      sets.push(`${column} = ?`);
      params.push(value);
    };

    if (patch.label !== undefined) push('label', patch.label);
    if (patch.value !== undefined) push('value', patch.value);

    if (sets.length === 0) {
      return 0;
    }
    push('updated_at', nowIso());
    params.push(id);
    const result = await this.db.run(
      `UPDATE quick_reference_entries SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return result.changes;
  }

  /** Deletes an entry; tag-junction rows cascade. */
  async delete(id: string): Promise<number> {
    const result = await this.db.run(
      'DELETE FROM quick_reference_entries WHERE id = ?',
      [id]
    );
    return result.changes;
  }

  /** Every (entryId, tag) assignment in one query — avoids an N+1 fetch. */
  async findAllTagAssignments(): Promise<{ entryId: string; tag: TagEntity }[]> {
    const rows = await this.db.query(
      `SELECT qt.entry_id AS entry_id, t.*
       FROM quick_reference_tags qt
       JOIN tags t ON t.id = qt.tag_id
       ORDER BY t.name`
    );
    return rows.map((row) => ({
      entryId: asString(row, 'entry_id'),
      tag: mapTagRow(row),
    }));
  }

  /** Attaches a tag to an entry (no-op if already attached). */
  async attachTag(entryId: string, tagId: string): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO quick_reference_tags (entry_id, tag_id)
       VALUES (?, ?)`,
      [entryId, tagId]
    );
  }

  /** Detaches a tag from an entry. */
  async detachTag(entryId: string, tagId: string): Promise<number> {
    const result = await this.db.run(
      'DELETE FROM quick_reference_tags WHERE entry_id = ? AND tag_id = ?',
      [entryId, tagId]
    );
    return result.changes;
  }
}
