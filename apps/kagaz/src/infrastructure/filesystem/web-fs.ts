/**
 * Web-fallback FileStorage backed by IndexedDB
 * (docs/architecture/01-system-architecture.md §Infrastructure: "web
 * fallback (IndexedDB-backed)"). Used by the browser web demo and dev
 * server; native builds use {@link CapacitorFileStorage}.
 *
 * Plain IndexedDB, no wrapper library (2026-11-19 bundle pass: Dexie cost
 * ~35 KB gz in the startup bundle for seven key-value calls that native
 * builds never make). Same database name, store and key path as the old
 * Dexie schema — Dexie stored schema version 1 as IndexedDB version 10 — so
 * files written before the switch are still there.
 */
import type { FileStorage } from './file-storage';

/** Stored file record (path is the primary key). */
interface StoredFile {
  path: string;
  data: Uint8Array;
  size: number;
  modifiedAt: string;
}

const STORE = 'files';
/** Dexie's `version(1)` is IndexedDB version 10; keep it for existing data. */
const DB_VERSION = 10;

/** Resolves an IndexedDB request. */
function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/** Keys that start with `prefix` (paths inside a directory and below). */
function underPrefix(prefix: string): IDBKeyRange {
  return IDBKeyRange.bound(prefix, `${prefix}￿`);
}

/** FileStorage over IndexedDB for the web platform. */
export class WebFileStorage implements FileStorage {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly databaseName = 'kagaz-files') {}

  /** Opens the database on first use (as Dexie did), not at construction. */
  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      const request = indexedDB.open(this.databaseName, DB_VERSION);
      request.onupgradeneeded = (): void => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: 'path' });
        }
      };
      this.db = done(request);
    }
    return this.db;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  private async get(path: string): Promise<StoredFile | undefined> {
    return done((await this.store('readonly')).get(path) as IDBRequest<StoredFile | undefined>);
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    const file: StoredFile = { path, data, size: data.byteLength, modifiedAt: new Date().toISOString() };
    await done((await this.store('readwrite')).put(file));
  }

  async read(path: string): Promise<Uint8Array> {
    const file = await this.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    return file.data;
  }

  async exists(path: string): Promise<boolean> {
    return (await this.get(path)) !== undefined;
  }

  async delete(path: string): Promise<void> {
    await done((await this.store('readwrite')).delete(path));
  }

  async list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    // Keys are the string `path` key path.
    const keys = (await done((await this.store('readonly')).getAllKeys(underPrefix(prefix)))) as string[];
    return keys
      .map((key) => key.slice(prefix.length))
      .filter((rest) => !rest.includes('/'));
  }

  async size(path: string): Promise<number> {
    const file = await this.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    return file.size;
  }

  async clearDirectory(dir: string): Promise<void> {
    await done((await this.store('readwrite')).delete(underPrefix(`${dir}/`)));
  }
}
