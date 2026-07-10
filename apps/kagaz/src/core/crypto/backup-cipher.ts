/**
 * Authenticated encryption for backup archives (SEC-V1 §8 #11,
 * 10-security-architecture.md §3.4 `backup_encryption_key`).
 *
 * [SEC] AES-256-GCM via the platform Web Crypto API — no third-party crypto,
 * no network, no WASM. The key is a random 256-bit value that lives only in
 * platform secure storage; it is passed in as 64 hex chars and never logged.
 *
 * Container layout (all one file, written as `*.enc`):
 *   [4B magic 'KGBK'][1B version][12B IV][ciphertext ‖ 16B GCM tag]
 * The magic + version let a future restore reject foreign/corrupt files before
 * attempting decryption; a wrong key or tampered bytes fail GCM authentication.
 */

/** File magic: "KGBK" (KaGaz BacKup). */
const MAGIC = Uint8Array.from([0x4b, 0x47, 0x42, 0x4b]);
/** Container format version. */
const VERSION = 1;
/** GCM nonce length in bytes (96-bit, the AES-GCM standard). */
const IV_LENGTH = 12;
const HEADER_LENGTH = MAGIC.length + 1; // magic + version byte

/**
 * Web Crypto's `BufferSource` excludes `SharedArrayBuffer`-backed views, but the
 * TS 6 lib widens `Uint8Array` to `Uint8Array<ArrayBufferLike>`. Every byte
 * array here is created from a regular `ArrayBuffer` (never shared), so this
 * assertion is sound and lets us pass buffers to `crypto.subtle` copy-free.
 */
function bufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes as Uint8Array<ArrayBuffer>;
}

/** Decodes 64 hex chars into a 32-byte key, rejecting malformed input. */
function hexToKeyBytes(keyHex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error('backup key must be 64 hex characters (256 bits)');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = Number.parseInt(keyHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bufferSource(hexToKeyBytes(keyHex)), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypts `plain` under `keyHex`, returning the self-describing container.
 * A fresh random IV is generated per call (never reuse an IV with a key).
 */
export async function encryptBackup(
  plain: Uint8Array,
  keyHex: string
): Promise<Uint8Array> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bufferSource(plain))
  );

  const out = new Uint8Array(HEADER_LENGTH + IV_LENGTH + cipher.length);
  out.set(MAGIC, 0);
  out[MAGIC.length] = VERSION;
  out.set(iv, HEADER_LENGTH);
  out.set(cipher, HEADER_LENGTH + IV_LENGTH);
  return out;
}

/**
 * Reverses {@link encryptBackup}. Throws on a bad magic/version (not a Kagaz
 * backup) or on authentication failure (wrong key or tampered bytes).
 */
export async function decryptBackup(
  container: Uint8Array,
  keyHex: string
): Promise<Uint8Array> {
  if (container.length < HEADER_LENGTH + IV_LENGTH) {
    throw new Error('backup file is truncated');
  }
  const magicOk = MAGIC.every((b, i) => container[i] === b);
  if (!magicOk) {
    throw new Error('not a Kagaz backup file');
  }
  if (container[MAGIC.length] !== VERSION) {
    throw new Error(`unsupported backup version: ${container[MAGIC.length]}`);
  }

  const iv = container.subarray(HEADER_LENGTH, HEADER_LENGTH + IV_LENGTH);
  const cipher = container.subarray(HEADER_LENGTH + IV_LENGTH);
  const key = await importKey(keyHex);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bufferSource(iv) },
    key,
    bufferSource(cipher)
  );
  return new Uint8Array(plain);
}
