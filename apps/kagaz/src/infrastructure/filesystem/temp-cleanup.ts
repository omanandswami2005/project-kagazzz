/**
 * Launch-time temp wipe ([SEC] 10-security-architecture.md §3.3).
 * temp/ may hold document content from interrupted operations (merge,
 * compress, …) and must not outlive the session that created it.
 */
import { STORAGE_DIRS, type FileStorage } from './file-storage';

/** Wipes the temp/ scratch directory. MUST run on every app launch. */
export async function cleanupTempFiles(storage: FileStorage): Promise<void> {
  await storage.clearDirectory(STORAGE_DIRS.temp);
}
