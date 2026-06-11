/** Platform selection for FileStorage. */
import { Capacitor } from '@capacitor/core';
import { CapacitorFileStorage } from './capacitor-fs';
import type { FileStorage } from './file-storage';
import { WebFileStorage } from './web-fs';

/** Returns the FileStorage implementation for the current platform. */
export function createFileStorage(
  platform: string = Capacitor.getPlatform()
): FileStorage {
  return platform === 'web' ? new WebFileStorage() : new CapacitorFileStorage();
}
