/**
 * File-storage protocol (docs/architecture/01-system-architecture.md
 * §Infrastructure Layer, 10-security-architecture.md §3.3).
 *
 * All file I/O goes through this interface — never through
 * `@capacitor/filesystem` or IndexedDB directly — so modules stay
 * platform-agnostic and testable. Paths are app-relative
 * (`documents/{uuid}.pdf`), never absolute (§3.3: no path leakage).
 */

/** Storage layout per 10-security §3.3 — all app files live under these. */
export const STORAGE_DIRS = {
  /** Imported/scanned/generated documents. */
  documents: 'documents',
  /** Generated thumbnails. */
  thumbnails: 'thumbnails',
  /** Scratch space for operations — wiped on every app launch. */
  temp: 'temp',
  /** Encrypted backup archives. */
  backups: 'backups',
} as const;

/** One of the well-known storage directories. */
export type StorageDir = (typeof STORAGE_DIRS)[keyof typeof STORAGE_DIRS];

/** Platform-agnostic file storage contract. */
export interface FileStorage {
  /** Writes (creating parent directories as needed), overwriting. */
  write(path: string, data: Uint8Array): Promise<void>;

  /** Reads a file fully. Throws if the file does not exist. */
  read(path: string): Promise<Uint8Array>;

  /** True when a file exists at the path. */
  exists(path: string): Promise<boolean>;

  /** Deletes a file; resolves silently if it was already gone. */
  delete(path: string): Promise<void>;

  /** Lists file names (not paths) directly inside a directory. */
  list(dir: string): Promise<string[]>;

  /** File size in bytes. Throws if the file does not exist. */
  size(path: string): Promise<number>;

  /** Removes every file in a directory (used for temp/ wipes). */
  clearDirectory(dir: string): Promise<void>;
}
