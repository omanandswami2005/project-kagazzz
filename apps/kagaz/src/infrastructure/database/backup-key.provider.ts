/**
 * Backup-archive encryption-key provisioning (SEC-V1 §8 #11).
 *
 * [SEC] 10-security-architecture.md §3.4: `backup_encryption_key` is a random
 * 256-bit value that lives only in platform secure storage (iOS Keychain /
 * Android Keystore), generated on first backup. It is distinct from the
 * SQLCipher `db_encryption_key` so a leaked backup key never exposes the live
 * database. Never hardcode, log, or persist it anywhere else.
 */
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { generateEncryptionKey } from './encryption-key.provider';

/** Secure-storage key under which the backup key is stored (§3.4). */
export const BACKUP_ENCRYPTION_KEY_NAME = 'backup_encryption_key';

/**
 * Returns the backup encryption key (64 hex chars), creating and persisting it
 * in secure storage on the first backup. The value must only be handed to the
 * backup cipher — callers must not log or re-store it.
 */
export async function getOrCreateBackupEncryptionKey(): Promise<string> {
  try {
    const { value } = await SecureStoragePlugin.get({
      key: BACKUP_ENCRYPTION_KEY_NAME,
    });
    if (value) {
      return value;
    }
  } catch {
    // The plugin rejects when the key is absent — fall through to generation.
  }

  const key = generateEncryptionKey();
  await SecureStoragePlugin.set({ key: BACKUP_ENCRYPTION_KEY_NAME, value: key });
  return key;
}
