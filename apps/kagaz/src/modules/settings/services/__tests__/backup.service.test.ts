import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { decryptBackup } from '@/core/crypto';
import type { DocumentEntity, FolderEntity } from '@/infrastructure/database/types';
import {
  backupFilename,
  buildBackupManifest,
  createBackup,
  type BackupDeps,
  type BackupManifest,
} from '../backup.service';

const KEY = 'c'.repeat(64);

function doc(id: string, filePath: string): DocumentEntity {
  return {
    id,
    name: `Doc ${id}`,
    filePath,
    fileType: 'application/pdf',
    fileSize: 3,
    isFavorite: false,
    isLocked: false,
    isArchived: false,
    language: 'en',
    sourceType: 'file_picker',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    synced: false,
    version: 1,
  };
}

const folder: FolderEntity = {
  id: 'f1',
  name: 'Personal',
  sortOrder: 0,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
};

function makeDeps(overrides: Partial<BackupDeps> = {}): {
  deps: BackupDeps;
  written: Map<string, Uint8Array>;
} {
  const written = new Map<string, Uint8Array>();
  const files: Record<string, Uint8Array> = {
    'documents/a.pdf': new TextEncoder().encode('AAA'),
    'documents/b.pdf': new TextEncoder().encode('BBB'),
  };
  const deps: BackupDeps = {
    listDocuments: vi.fn(async () => [doc('a', 'documents/a.pdf'), doc('b', 'documents/b.pdf')]),
    listFolders: vi.fn(async () => [folder]),
    readFile: vi.fn(async (p: string) => {
      const f = files[p];
      if (!f) throw new Error(`missing ${p}`);
      return f;
    }),
    writeFile: vi.fn(async (p: string, bytes: Uint8Array) => {
      written.set(p, bytes);
    }),
    getBackupKey: vi.fn(async () => KEY),
    now: () => new Date('2026-07-10T09:35:07.000Z'),
    ...overrides,
  };
  return { deps, written };
}

describe('buildBackupManifest', () => {
  it('is self-describing with counts and full rows', () => {
    const m = buildBackupManifest([doc('a', 'documents/a.pdf')], [folder], '2026-07-10T00:00:00Z');
    expect(m.format).toBe('kagaz-backup');
    expect(m.version).toBe(1);
    expect(m.counts).toEqual({ documents: 1, folders: 1 });
    expect(m.documents[0].id).toBe('a');
    expect(m.folders[0].name).toBe('Personal');
  });
});

describe('backupFilename', () => {
  it('formats a zero-padded UTC timestamp', () => {
    expect(backupFilename(new Date('2026-07-05T03:08:09.000Z'))).toBe(
      'kagaz_backup_20260705-030809.enc'
    );
  });
});

describe('createBackup (SEC-V1 #11)', () => {
  it('writes an encrypted archive that decrypts+unzips to the manifest and files', async () => {
    const { deps, written } = makeDeps();
    const result = await createBackup(deps);

    expect(result.path).toBe('backups/kagaz_backup_20260710-093507.enc');
    expect(result.documentCount).toBe(2);
    expect(result.skippedFiles).toEqual([]);

    const container = written.get(result.path);
    expect(container).toBeDefined();
    expect(container!.length).toBe(result.sizeBytes);

    // Decrypt -> a valid ZIP -> manifest + both files, verbatim.
    const zipBytes = await decryptBackup(container!, KEY);
    const zip = await JSZip.loadAsync(zipBytes);
    const manifest = JSON.parse(
      await zip.file('manifest.json')!.async('string')
    ) as BackupManifest;
    expect(manifest.counts.documents).toBe(2);
    expect(await zip.file('documents/a.pdf')!.async('string')).toBe('AAA');
    expect(await zip.file('documents/b.pdf')!.async('string')).toBe('BBB');
  });

  it('never writes plaintext — the archive is not a readable ZIP without the key', async () => {
    const { deps, written } = makeDeps();
    const result = await createBackup(deps);
    // A ZIP starts with 'PK\x03\x04'; the encrypted container must not.
    const head = written.get(result.path)!.slice(0, 4);
    expect(Array.from(head)).not.toEqual([0x50, 0x4b, 0x03, 0x04]);
    await expect(JSZip.loadAsync(written.get(result.path)!)).rejects.toThrow();
  });

  it('skips unreadable files without aborting the backup', async () => {
    const { deps } = makeDeps({
      readFile: vi.fn(async (p: string) => {
        if (p === 'documents/b.pdf') throw new Error('gone');
        return new TextEncoder().encode('AAA');
      }),
    });
    const result = await createBackup(deps);
    expect(result.skippedFiles).toEqual(['documents/b.pdf']);
    expect(result.documentCount).toBe(2);
  });

  it('generates the key exactly once via the provider', async () => {
    const { deps } = makeDeps();
    await createBackup(deps);
    expect(deps.getBackupKey).toHaveBeenCalledTimes(1);
  });
});
