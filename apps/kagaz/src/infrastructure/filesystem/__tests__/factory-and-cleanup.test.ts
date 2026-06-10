import { describe, expect, it, vi } from 'vitest';
import { CapacitorFileStorage } from '../capacitor-fs';
import { createFileStorage } from '../factory';
import { STORAGE_DIRS, type FileStorage } from '../file-storage';
import { cleanupTempFiles } from '../temp-cleanup';
import { WebFileStorage } from '../web-fs';

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}));

describe('createFileStorage', () => {
  it('returns the IndexedDB store on web', () => {
    expect(createFileStorage('web')).toBeInstanceOf(WebFileStorage);
  });

  it('returns the native store on android/ios', () => {
    expect(createFileStorage('android')).toBeInstanceOf(CapacitorFileStorage);
    expect(createFileStorage('ios')).toBeInstanceOf(CapacitorFileStorage);
  });

  it('defaults to the detected platform', () => {
    expect(createFileStorage()).toBeInstanceOf(WebFileStorage);
  });
});

describe('cleanupTempFiles', () => {
  it('clears exactly the temp directory (SEC §3.3 launch wipe)', async () => {
    const storage: FileStorage = {
      write: vi.fn(),
      read: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      size: vi.fn(),
      clearDirectory: vi.fn(async () => undefined),
    };
    await cleanupTempFiles(storage);
    expect(storage.clearDirectory).toHaveBeenCalledExactlyOnceWith(
      STORAGE_DIRS.temp
    );
  });
});
