/**
 * tags + document_tags DAO (docs/architecture/09-database-design.md
 * §4.3–§4.4). Tag names are unique; attach/detach manages the junction.
 */
import type { DbConnection, SqlRow } from '../connection';
import type { TagEntity } from '../types';
import { asOptionalString, asString, newId, nowIso } from './row-mapping';

function mapRow(row: SqlRow): TagEntity {
  return {
    id: asString(row, 'id'),
    name: asString(row, 'name'),
    color: asOptionalString(row, 'color'),
    createdAt: asString(row, 'created_at'),
  };
}

/** Typed access to tags and the document_tags junction. */
export class TagDao {
  constructor(private readonly db: DbConnection) {}

  /** Returns a tag by id, or null. */
  async findById(id: string): Promise<TagEntity | null> {
    const rows = await this.db.query('SELECT * FROM tags WHERE id = ?', [id]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  /** Lists all tags alphabetically. */
  async findAll(): Promise<TagEntity[]> {
    const rows = await this.db.query('SELECT * FROM tags ORDER BY name');
    return rows.map(mapRow);
  }

  /**
   * Every (documentId, tag) assignment in one query — lets the vault
   * render each row's chips without an N+1 fetch (F-10).
   */
  async findAllAssignments(): Promise<{ documentId: string; tag: TagEntity }[]> {
    const rows = await this.db.query(
      `SELECT dt.document_id AS document_id, t.*
       FROM document_tags dt
       JOIN tags t ON t.id = dt.tag_id
       ORDER BY t.name`
    );
    return rows.map((row) => ({
      documentId: asString(row, 'document_id'),
      tag: mapRow(row),
    }));
  }

  /** Lists tags attached to a document. */
  async findByDocument(documentId: string): Promise<TagEntity[]> {
    const rows = await this.db.query(
      `SELECT t.* FROM tags t
       JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?
       ORDER BY t.name`,
      [documentId]
    );
    return rows.map(mapRow);
  }

  /** Creates a tag (name uniqueness enforced by the DB). */
  async create(name: string, color?: string): Promise<TagEntity> {
    const id = newId();
    await this.db.run(
      'INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      [id, name, color ?? null, nowIso()]
    );
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`tags insert for ${id} did not persist`);
    }
    return created;
  }

  /** Deletes a tag; junction rows cascade. */
  async delete(id: string): Promise<number> {
    const result = await this.db.run('DELETE FROM tags WHERE id = ?', [id]);
    return result.changes;
  }

  /** Attaches a tag to a document (no-op if already attached). */
  async attach(documentId: string, tagId: string): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO document_tags (document_id, tag_id)
       VALUES (?, ?)`,
      [documentId, tagId]
    );
  }

  /** Detaches a tag from a document. */
  async detach(documentId: string, tagId: string): Promise<number> {
    const result = await this.db.run(
      'DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?',
      [documentId, tagId]
    );
    return result.changes;
  }
}
