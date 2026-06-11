import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Filesystem } from '@capacitor/filesystem';
import { bytesToBase64 } from '../base64';
import { CapacitorFileStorage } from '../capacitor-fs';

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: {
    writeFile: vi.fn(async () => ({ uri: 'x' })),
    readFile: vi.fn(),
    deleteFile: vi.fn(async () => undefined),
    readdir: vi.fn(),
    stat: vi.fn(),
    rmdir: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
  },
}));

const fs = vi.mocked(Filesystem);
const data = new Uint8Array([1, 2, 3]);

describe('CapacitorFileStorage', () => {
  let storage: CapacitorFileStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new CapacitorFileStorage();
  });

  it('write sends base64 into the sandboxed data directory, recursive', async () => {
    await storage.write('documents/a.pdf', data);
    expect(fs.writeFile).toHaveBeenCalledWith({
      path: 'documents/a.pdf',
      data: bytesToBase64(data),
      directory: 'DATA',
      recursive: true,
    });
  });

  it('read decodes base64 payloads', async () => {
    fs.readFile.mockResolvedValueOnce({ data: bytesToBase64(data) });
    expect(await storage.read('documents/a.pdf')).toEqual(data);
  });

  it('read unwraps Blob payloads (web plugin variant)', async () => {
    fs.readFile.mockResolvedValueOnce({ data: new Blob([data]) });
    expect(await storage.read('documents/a.pdf')).toEqual(data);
  });

  it('exists maps stat success/failure to boolean', async () => {
    fs.stat.mockResolvedValueOnce({
      name: 'a',
      type: 'file',
      size: 3,
      ctime: 0,
      mtime: 0,
      uri: 'x',
    });
    expect(await storage.exists('a')).toBe(true);
    fs.stat.mockRejectedValueOnce(new Error('not found'));
    expect(await storage.exists('b')).toBe(false);
  });

  it('delete swallows missing-file errors (idempotent)', async () => {
    fs.deleteFile.mockRejectedValueOnce(new Error('not found'));
    await expect(storage.delete('gone')).resolves.toBeUndefined();
  });

  it('list returns file names only, empty for missing dirs', async () => {
    fs.readdir.mockResolvedValueOnce({
      files: [
        { name: 'a.pdf', type: 'file', size: 1, ctime: 0, mtime: 0, uri: 'x' },
        { name: 'sub', type: 'directory', size: 0, ctime: 0, mtime: 0, uri: 'y' },
      ],
    });
    expect(await storage.list('documents')).toEqual(['a.pdf']);
    fs.readdir.mockRejectedValueOnce(new Error('no such dir'));
    expect(await storage.list('nope')).toEqual([]);
  });

  it('size returns stat.size', async () => {
    fs.stat.mockResolvedValueOnce({
      name: 'a',
      type: 'file',
      size: 1234,
      ctime: 0,
      mtime: 0,
      uri: 'x',
    });
    expect(await storage.size('a')).toBe(1234);
  });

  it('clearDirectory recreates the directory even if rmdir fails', async () => {
    fs.rmdir.mockRejectedValueOnce(new Error('missing'));
    await storage.clearDirectory('temp');
    expect(fs.mkdir).toHaveBeenCalledWith({
      path: 'temp',
      directory: 'DATA',
      recursive: true,
    });
  });
});
