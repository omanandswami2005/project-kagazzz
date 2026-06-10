/**
 * app_settings DAO (docs/architecture/09-database-design.md §4.11).
 * JSON-encoded key-value store for app preferences.
 */
import type { DbConnection } from '../connection';
import { asString, nowIso } from './row-mapping';

/** Typed access to app_settings. */
export class SettingsDao {
  constructor(private readonly db: DbConnection) {}

  /**
   * Reads and JSON-parses a setting.
   * @returns the parsed value, or null when unset.
   */
  async get<T>(key: string): Promise<T | null> {
    const rows = await this.db.query(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    if (!rows[0]) {
      return null;
    }
    const raw = asString(rows[0], 'value');
    return JSON.parse(raw) as T;
  }

  /** JSON-encodes and upserts a setting. */
  async set(key: string, value: unknown): Promise<void> {
    await this.db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value,
         updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), nowIso()]
    );
  }

  /** Removes a setting. */
  async remove(key: string): Promise<number> {
    const result = await this.db.run(
      'DELETE FROM app_settings WHERE key = ?',
      [key]
    );
    return result.changes;
  }
}
