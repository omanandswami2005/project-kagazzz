/**
 * Web-fallback FileStorage backed by IndexedDB via Dexie
 * (docs/architecture/01-system-architecture.md §Infrastructure: "web
 * fallback (IndexedDB-backed)"). Used by the PWA build and dev server;
 * native builds use {@link CapacitorFileStorage}.
 */
import Dexie, { type Table } from 'dexie';
import type { FileStorage } from './file-storage';

/** Stored file record (path is the primary key). */
interface StoredFile {
  path: string;
  data: Uint8Array;
  size: number;
  modifiedAt: string;
}

class KagazFilesDb extends Dexie {
  files!: Table<StoredFile, string>;

  constructor(name = 'kagaz-files') {
    super(name);
    this.version(1).stores({ files: 'path' });
  }
}

/** FileStorage over IndexedDB for the web platform. */
export class WebFileStorage implements FileStorage {
  private readonly db: KagazFilesDb;

  constructor(databaseName?: string) {
    this.db = new KagazFilesDb(databaseName);
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    await this.db.files.put({
      path,
      data,
      size: data.byteLength,
      modifiedAt: new Date().toISOString(),
    });
  }

  async read(path: string): Promise<Uint8Array> {
    const file = await this.db.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    return file.data;
  }

  async exists(path: string): Promise<boolean> {
    return (await this.db.files.get(path)) !== undefined;
  }

  async delete(path: string): Promise<void> {
    await this.db.files.delete(path);
  }

  async list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    const inDir = await this.db.files
      .where('path')
      .startsWith(prefix)
      .primaryKeys();
    return inDir
      .map((path) => path.slice(prefix.length))
      .filter((rest) => !rest.includes('/'));
  }

  async size(path: string): Promise<number> {
    const file = await this.db.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    return file.size;
  }

  async clearDirectory(dir: string): Promise<void> {
    await this.db.files
      .where('path')
      .startsWith(`${dir}/`)
      .delete();
  }
}
