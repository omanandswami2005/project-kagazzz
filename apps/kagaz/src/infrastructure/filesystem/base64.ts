/**
 * Uint8Array ↔ base64 helpers.
 * `@capacitor/filesystem` exchanges binary data as base64 strings; these
 * convert in chunks to stay within the JS engine's argument limits on
 * multi-megabyte documents.
 */

const CHUNK_SIZE = 0x8000;

/** Encodes bytes as a base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

/** Decodes a base64 string into bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
