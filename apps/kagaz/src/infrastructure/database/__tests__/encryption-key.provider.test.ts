import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  DB_ENCRYPTION_KEY_NAME,
  generateEncryptionKey,
  getOrCreateDbEncryptionKey,
} from '../encryption-key.provider';

vi.mock('capacitor-secure-storage-plugin', () => ({
  SecureStoragePlugin: {
    get: vi.fn(),
    set: vi.fn(async () => ({ value: true })),
  },
}));

const mockedGet = vi.mocked(SecureStoragePlugin.get);
const mockedSet = vi.mocked(SecureStoragePlugin.set);

describe('generateEncryptionKey', () => {
  it('produces 256-bit keys as 64 hex chars, unique per call', () => {
    const key = generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(generateEncryptionKey()).not.toBe(key);
  });
});

describe('getOrCreateDbEncryptionKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing key from secure storage', async () => {
    mockedGet.mockResolvedValueOnce({ value: 'cafe'.repeat(16) });
    const key = await getOrCreateDbEncryptionKey();
    expect(key).toBe('cafe'.repeat(16));
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it('generates and stores a key on first launch (plugin rejects)', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Item not found'));
    const key = await getOrCreateDbEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(mockedSet).toHaveBeenCalledWith({
      key: DB_ENCRYPTION_KEY_NAME,
      value: key,
    });
  });

  it('regenerates when storage returns an empty value', async () => {
    mockedGet.mockResolvedValueOnce({ value: '' });
    const key = await getOrCreateDbEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(mockedSet).toHaveBeenCalledOnce();
  });

  it('uses the documented secure-storage key name (§3.4)', () => {
    expect(DB_ENCRYPTION_KEY_NAME).toBe('db_encryption_key');
  });
});
