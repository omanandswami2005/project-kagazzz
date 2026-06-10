import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { WebFileStorage } from '../web-fs';

const data = new Uint8Array([37, 80, 68, 70]);

describe('WebFileStorage (against fake IndexedDB)', () => {
  let storage: WebFileStorage;
  let counter = 0;

  beforeEach(() => {
    counter += 1;
    storage = new WebFileStorage(`kagaz-files-test-${counter}`);
  });

  it('writes and reads bytes back', async () => {
    await storage.write('documents/a.pdf', data);
    // Array.from: structured clone in IndexedDB returns a Uint8Array from
    // another realm, which fails toEqual's class-identity check.
    expect(Array.from(await storage.read('documents/a.pdf'))).toEqual(
      Array.from(data)
    );
  });

  it('overwrites on repeated writes', async () => {
    await storage.write('documents/a.pdf', data);
    const newer = new Uint8Array([9, 9]);
    await storage.write('documents/a.pdf', newer);
    expect(Array.from(await storage.read('documents/a.pdf'))).toEqual([9, 9]);
    expect(await storage.size('documents/a.pdf')).toBe(2);
  });

  it('read/size throw for missing files', async () => {
    await expect(storage.read('missing')).rejects.toThrow('File not found');
    await expect(storage.size('missing')).rejects.toThrow('File not found');
  });

  it('exists reflects presence; delete is idempotent', async () => {
    expect(await storage.exists('documents/a.pdf')).toBe(false);
    await storage.write('documents/a.pdf', data);
    expect(await storage.exists('documents/a.pdf')).toBe(true);
    await storage.delete('documents/a.pdf');
    await storage.delete('documents/a.pdf');
    expect(await storage.exists('documents/a.pdf')).toBe(false);
  });

  it('list returns direct children only', async () => {
    await storage.write('documents/a.pdf', data);
    await storage.write('documents/b.jpg', data);
    await storage.write('documents/nested/c.pdf', data);
    await storage.write('thumbnails/a_thumb.jpg', data);
    expect((await storage.list('documents')).sort()).toEqual([
      'a.pdf',
      'b.jpg',
    ]);
  });

  it('clearDirectory removes everything under the directory', async () => {
    await storage.write('temp/x.tmp', data);
    await storage.write('temp/nested/y.tmp', data);
    await storage.write('documents/keep.pdf', data);
    await storage.clearDirectory('temp');
    expect(await storage.exists('temp/x.tmp')).toBe(false);
    expect(await storage.exists('temp/nested/y.tmp')).toBe(false);
    expect(await storage.exists('documents/keep.pdf')).toBe(true);
  });
});
