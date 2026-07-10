import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup } from '../backup-cipher';

const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);
const enc = new TextEncoder();

describe('backup-cipher (SEC-V1 #11)', () => {
  it('round-trips arbitrary bytes', async () => {
    const plain = enc.encode('the quick brown fox — दस्तावेज़ 📄');
    const container = await encryptBackup(plain, KEY);
    const back = await decryptBackup(container, KEY);
    expect(new TextDecoder().decode(back)).toBe('the quick brown fox — दस्तावेज़ 📄');
  });

  it('round-trips an empty payload', async () => {
    const back = await decryptBackup(await encryptBackup(new Uint8Array(), KEY), KEY);
    expect(back.length).toBe(0);
  });

  it('produces a self-describing container (magic + version header)', async () => {
    const container = await encryptBackup(enc.encode('x'), KEY);
    // 'KGBK' magic, version 1
    expect(Array.from(container.slice(0, 5))).toEqual([0x4b, 0x47, 0x42, 0x4b, 1]);
    // header(5) + iv(12) + ciphertext(1) + tag(16)
    expect(container.length).toBe(5 + 12 + 1 + 16);
  });

  it('uses a fresh IV each call (ciphertexts differ)', async () => {
    const a = await encryptBackup(enc.encode('same'), KEY);
    const b = await encryptBackup(enc.encode('same'), KEY);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('fails authentication with the wrong key', async () => {
    const container = await encryptBackup(enc.encode('secret'), KEY);
    await expect(decryptBackup(container, OTHER_KEY)).rejects.toThrow();
  });

  it('rejects a tampered ciphertext', async () => {
    const container = await encryptBackup(enc.encode('secret'), KEY);
    container[container.length - 1] ^= 0xff; // flip a tag bit
    await expect(decryptBackup(container, KEY)).rejects.toThrow();
  });

  it('rejects a foreign file (bad magic)', async () => {
    await expect(decryptBackup(enc.encode('not-a-backup-file-at-all'), KEY)).rejects.toThrow(
      /not a Kagaz backup/
    );
  });

  it('rejects a truncated file', async () => {
    await expect(decryptBackup(new Uint8Array([0x4b, 0x47]), KEY)).rejects.toThrow(/truncated/);
  });

  it('rejects a malformed key', async () => {
    await expect(encryptBackup(enc.encode('x'), 'tooshort')).rejects.toThrow(/64 hex/);
  });
});
