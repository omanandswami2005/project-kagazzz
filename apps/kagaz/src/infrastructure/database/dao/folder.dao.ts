/**
 * folders DAO (docs/architecture/09-database-design.md §4.2).
 * Hierarchy via self-referencing parent_id; deleting a folder cascades to
 * child folders (DB constraint) while documents fall back to root
 * (ON DELETE SET NULL).
 */
import type { DbConnection, SqlRow, SqlValue } from '../connection';
import type { FolderEntity, NewFolder } from '../types';
import {
  asNumber,
  asOptionalString,
  asString,
  newId,
  nowIso,
} from './row-mapping';

function mapRow(row: SqlRow): FolderEntity {
  return {
    id: asString(row, 'id'),
    name: asString(row, 'name'),
    parentId: asOptionalString(row, 'parent_id'),
    icon: asOptionalString(row, 'icon'),
    color: asOptionalString(row, 'color'),
    sortOrder: asNumber(row, 'sort_order'),
    createdAt: asString(row, 'created_at'),
    updatedAt: asString(row, 'updated_at'),
  };
}

/** Typed access to the folders table. */
export class FolderDao {
  constructor(private readonly db: DbConnection) {}

  /** Returns a folder by id, or null. */
  async findById(id: string): Promise<FolderEntity | null> {
    const rows = await this.db.query('SELECT * FROM folders WHERE id = ?', [
      id,
    ]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  /** Lists children of a folder (null = root level) in sort order. */
  async findChildren(parentId: string | null): Promise<FolderEntity[]> {
    const sql = parentId
      ? 'SELECT * FROM folders WHERE parent_id = ? ORDER BY sort_order, name'
      : 'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY sort_order, name';
    const rows = await this.db.query(sql, parentId ? [parentId] : []);
    return rows.map(mapRow);
  }

  /** Lists every folder (tree assembly happens in the service layer). */
  async findAll(): Promise<FolderEntity[]> {
    const rows = await this.db.query(
      'SELECT * FROM folders ORDER BY sort_order, name'
    );
    return rows.map(mapRow);
  }

  /** Inserts a new folder and returns the stored row. */
  async create(folder: NewFolder): Promise<FolderEntity> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO folders (id, name, parent_id, icon, color, sort_order,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        folder.name,
        folder.parentId ?? null,
        folder.icon ?? null,
        folder.color ?? null,
        folder.sortOrder,
        now,
        now,
      ]
    );
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`folders insert for ${id} did not persist`);
    }
    return created;
  }

  /**
   * Updates name/appearance/position fields; bumps updated_at.
   * Pass `null` to clear a nullable column (e.g. `parentId: null` moves the
   * folder to the root level).
   */
  async update(
    id: string,
    patch: {
      name?: string;
      parentId?: string | null;
      icon?: string | null;
      color?: string | null;
      sortOrder?: number;
    }
  ): Promise<number> {
    const sets: string[] = [];
    const params: SqlValue[] = [];
    const push = (column: string, value: SqlValue): void => {
      sets.push(`${column} = ?`);
      params.push(value);
    };

    if (patch.name !== undefined) push('name', patch.name);
    if (patch.parentId !== undefined) push('parent_id', patch.parentId ?? null);
    if (patch.icon !== undefined) push('icon', patch.icon ?? null);
    if (patch.color !== undefined) push('color', patch.color ?? null);
    if (patch.sortOrder !== undefined) push('sort_order', patch.sortOrder);

    if (sets.length === 0) {
      return 0;
    }
    push('updated_at', nowIso());
    params.push(id);
    const result = await this.db.run(
      `UPDATE folders SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return result.changes;
  }

  /**
   * Hard-deletes a folder. Child folders cascade (DDL); documents in the
   * folder move to root via ON DELETE SET NULL.
   */
  async delete(id: string): Promise<number> {
    const result = await this.db.run('DELETE FROM folders WHERE id = ?', [id]);
    return result.changes;
  }
}
