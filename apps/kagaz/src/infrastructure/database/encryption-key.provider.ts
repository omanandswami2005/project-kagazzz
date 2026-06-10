/**
 * SQLCipher encryption-key provisioning.
 *
 * [SEC] docs/architecture/10-security-architecture.md §3.2/§3.4:
 * the key is a random 256-bit value that lives exclusively in the
 * platform secure storage (iOS Keychain / Android Keystore). It must
 * never be hardcoded, logged, or persisted anywhere else.
 */
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

/** Secure-storage key under which the DB encryption key is stored (§3.4). */
export const DB_ENCRYPTION_KEY_NAME = 'db_encryption_key';

/** Generates a random 256-bit key encoded as 64 lowercase hex chars. */
export function generateEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the SQLCipher key, creating and persisting it in secure storage
 * on first launch. The returned value must only ever be handed to the
 * SQLite connection — callers must not log or re-store it.
 */
export async function getOrCreateDbEncryptionKey(): Promise<string> {
  try {
    const { value } = await SecureStoragePlugin.get({
      key: DB_ENCRYPTION_KEY_NAME,
    });
    if (value) {
      return value;
    }
  } catch {
    // capacitor-secure-storage-plugin rejects when the key does not exist —
    // fall through to first-launch generation.
  }

  const key = generateEncryptionKey();
  await SecureStoragePlugin.set({ key: DB_ENCRYPTION_KEY_NAME, value: key });
  return key;
}
