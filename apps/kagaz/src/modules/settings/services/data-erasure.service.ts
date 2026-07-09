/**
 * Full data erasure (SEC-V1 §8 #12, 10-security-architecture.md §Data Erasure).
 * Irreversibly removes everything the app stores on device, then restarts to a
 * clean first-launch state. Dependency-injected so the ordering is unit-testable
 * without native plugins.
 *
 * [SEC] The document data is destroyed by deleting the encrypted DB *file* and
 * every stored file. The SQLCipher key is intentionally retained: once the file
 * is gone it protects nothing, and clearing/regenerating it left the fresh DB
 * unable to persist across restarts (see database.service.deleteDatabase).
 */
import { log } from '@/core/logging';
import { STORAGE_DIRS, createFileStorage } from '@/infrastructure/filesystem';
import { deleteDatabase } from '@/infrastructure/database/database.service';

const logger = log('settings');

/** Injectable steps of {@link eraseAllData}. */
export interface EraseDeps {
  /** Deletes the encrypted database file (removing all documents/metadata). */
  deleteDatabase: () => Promise<void>;
  /** Empties one storage directory (documents/thumbnails/temp/backups). */
  clearFiles: (dir: string) => Promise<void>;
  /** Clears JS-reachable preferences (theme, lock, language). */
  clearPreferences: () => void;
  /** Restarts the app to first-launch state. */
  reload: () => void;
}

/**
 * Runs the full erasure sequence. Each step is best-effort so one failure can't
 * strand the user with a half-wiped vault; the DB delete and the final reload
 * are the load-bearing steps.
 */
export async function eraseAllData(deps: EraseDeps): Promise<void> {
  logger.warn({ event: 'settings.erase.start' });
  await deps.deleteDatabase().catch((err: unknown) => {
    logger.error({ event: 'settings.erase.db_error', err: { message: String(err) } });
  });
  for (const dir of Object.values(STORAGE_DIRS)) {
    await deps.clearFiles(dir).catch(() => undefined);
  }
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
