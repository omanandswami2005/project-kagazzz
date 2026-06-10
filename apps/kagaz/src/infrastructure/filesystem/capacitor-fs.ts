/**
 * Native FileStorage implementation over `@capacitor/filesystem`.
 * Files live in the OS-sandboxed app data directory
 * (10-security-architecture.md §3.3) under app-relative paths.
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { base64ToBytes, bytesToBase64 } from './base64';
import type { FileStorage } from './file-storage';

/** FileStorage backed by the platform filesystem (Android/iOS). */
export class CapacitorFileStorage implements FileStorage {
  /** Sandboxed app data root; not user-visible, removed on uninstall. */
  private readonly directory = Directory.Data;

  async write(path: string, data: Uint8Array): Promise<void> {
    await Filesystem.writeFile({
      path,
      data: bytesToBase64(data),
      directory: this.directory,
      recursive: true,
    });
  }

  async read(path: string): Promise<Uint8Array> {
    const result = await Filesystem.readFile({
      path,
      directory: this.directory,
    });
    if (typeof result.data !== 'string') {
      // Web builds of the plugin may return a Blob; native returns base64.
      const buffer = await result.data.arrayBuffer();
      return new Uint8Array(buffer);
    }
    return base64ToBytes(result.data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path, directory: this.directory });
      return true;
    } catch {
      return false;
    }
  }

  async delete(path: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path, directory: this.directory });
    } catch {
      // Already gone — deletion is idempotent by contract.
    }
  }

  async list(dir: string): Promise<string[]> {
    try {
      const result = await Filesystem.readdir({
        path: dir,
        directory: this.directory,
      });
      return result.files
        .filter((f) => f.type === 'file')
        .map((f) => f.name);
    } catch {
      return [];
    }
  }

  async size(path: string): Promise<number> {
    const stat = await Filesystem.stat({ path, directory: this.directory });
    return stat.size;
  }

  async clearDirectory(dir: string): Promise<void> {
    try {
      await Filesystem.rmdir({
        path: dir,
        directory: this.directory,
        recursive: true,
      });
    } catch {
      // Directory may not exist yet — nothing to clear.
    }
    await Filesystem.mkdir({
      path: dir,
      directory: this.directory,
      recursive: true,
    });
  }
}

/**
 * Re-exported so callers needing text round-trips use the same encoding
 * constant the plugin understands.
 */
export { Encoding };
