/**
 * Full data erasure (SEC-V1 §8 #12, 10-security-architecture.md §Data Erasure).
 * Irreversibly removes everything the app stores on device, then restarts to a
 * clean first-launch state. Dependency-injected so the ordering is unit-testable
 * without native plugins.
 *
 * [SEC] Order matters: delete the encrypted DB *before* removing its key (the
 * file can't be opened to delete once the SQLCipher secret is gone).
 */
import { log } from '@/core/logging';
import { STORAGE_DIRS, createFileStorage } from '@/infrastructure/filesystem';
import { deleteDatabase } from '@/infrastructure/database/database.service';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

const logger = log('settings');

/** Injectable steps of {@link eraseAllData}. */
export interface EraseDeps {
  /** Deletes the encrypted database file (while its key is still active). */
  deleteDatabase: () => Promise<void>;
  /** Empties one storage directory (documents/thumbnails/temp/backups). */
  clearFiles: (dir: string) => Promise<void>;
  /** Clears platform secure storage (the DB encryption key). */
  clearSecureStorage: () => Promise<void>;
  /** Clears JS-reachable preferences (theme, lock, language). */
  clearPreferences: () => void;
  /** Restarts the app to first-launch state. */
  reload: () => void;
}

/**
 * Runs the full erasure sequence. Each file/secure step is best-effort so one
 * failure can't strand the user with a half-wiped vault; the DB delete and the
 * final reload are the load-bearing steps.
 */
export async function eraseAllData(deps: EraseDeps): Promise<void> {
  logger.warn({ event: 'settings.erase.start' });
  // Every step is best-effort: none may abort the sequence, because the final
  // reload is what returns the app to a clean state (a deleted DB whose delete
  // call still threw, or a missing dir, must not strand a half-wiped vault).
  // The DB is still deleted first, while its SQLCipher key is active.
  await deps.deleteDatabase().catch((err: unknown) => {
    logger.error({ event: 'settings.erase.db_error', err: { message: String(err) } });
  });
  for (const dir of Object.values(STORAGE_DIRS)) {
    await deps.clearFiles(dir).catch(() => undefined);
  }
  await deps.clearSecureStorage().catch(() => undefined);
  deps.clearPreferences();
  logger.warn({ event: 'settings.erase.success' });
  deps.reload();
}

/** Wires {@link eraseAllData} to the real platform services. */
export function createDataEraser(): () => Promise<void> {
  const storage = createFileStorage();
  return () =>
    eraseAllData({
      deleteDatabase,
      clearFiles: (dir) => storage.clearDirectory(dir),
      clearSecureStorage: () => SecureStoragePlugin.clear().then(() => undefined),
      clearPreferences: () => {
        // Remove app UI prefs + the i18n language cache; leave nothing behind.
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('kagaz:') || key === 'i18nextLng') {
            localStorage.removeItem(key);
          }
        }
      },
      reload: () => window.location.reload(),
    });
}
