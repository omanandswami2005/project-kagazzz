import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { decryptBackup, encryptBackup } from '@/core/crypto';
import type {
  DocumentEntity,
  FolderEntity,
  NewDocument,
  NewFolder,
} from '@/infrastructure/database/types';
import {
  applyBackup,
  backupFilename,
  buildBackupManifest,
  createBackup,
  decryptAndParseBackup,
  type BackupDeps,
  type BackupManifest,
  type RestoreDeps,
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

/** Fakes FolderDao/DocumentDao.create + FileStorage.write, recording calls. */
function makeRestoreDeps(): {
  deps: RestoreDeps;
  createdFolders: NewFolder[];
  createdDocuments: NewDocument[];
  written: Map<string, Uint8Array>;
} {
  const createdFolders: NewFolder[] = [];
  const createdDocuments: NewDocument[] = [];
  const written = new Map<string, Uint8Array>();
  let folderSeq = 0;
  let docSeq = 0;
  const deps: RestoreDeps = {
    createFolder: vi.fn(async (folder: NewFolder): Promise<FolderEntity> => {
      createdFolders.push(folder);
      folderSeq += 1;
      return { ...folder, id: `new-folder-${folderSeq}`, createdAt: 'now', updatedAt: 'now' };
    }),
    createDocument: vi.fn(async (doc: NewDocument): Promise<DocumentEntity> => {
      createdDocuments.push(doc);
      docSeq += 1;
      return {
        ...doc,
        id: `new-doc-${docSeq}`,
        createdAt: 'now',
        updatedAt: 'now',
        synced: false,
        version: 1,
      };
    }),
    writeFile: vi.fn(async (p: string, bytes: Uint8Array) => {
      written.set(p, bytes);
    }),
  };
  return { deps, createdFolders, createdDocuments, written };
}

describe('decryptAndParseBackup (restore, SEC-V1 #11)', () => {
  it('decrypts and parses a real archive round-trip', async () => {
    const { deps, written } = makeDeps();
    const result = await createBackup(deps);
    const bytes = written.get(result.path)!;

    const parsed = await decryptAndParseBackup(bytes, KEY);
    expect(parsed.manifest.format).toBe('kagaz-backup');
    expect(parsed.manifest.counts.documents).toBe(2);
    expect(await parsed.zip.file('documents/a.pdf')!.async('string')).toBe('AAA');
  });

  it('rejects with a clear message on the wrong key (a different device/install)', async () => {
    const { deps, written } = makeDeps();
    const result = await createBackup(deps);
    const bytes = written.get(result.path)!;

    await expect(decryptAndParseBackup(bytes, 'd'.repeat(64))).rejects.toThrow(
      /different device|corrupted/
    );
  });

  it('rejects a foreign (non-Kagaz) encrypted archive', async () => {
    const foreign = await encryptBackup(new TextEncoder().encode('not a zip at all'), KEY);
    await expect(decryptAndParseBackup(foreign, KEY)).rejects.toThrow(/corrupted/);
  });

  it('rejects an archive with no manifest.json', async () => {
    const zip = new JSZip();
    zip.file('documents/a.pdf', 'AAA');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const encrypted = await encryptBackup(bytes, KEY);
    await expect(decryptAndParseBackup(encrypted, KEY)).rejects.toThrow(/not a kagaz backup/i);
  });

  it('rejects an unsupported manifest version', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ format: 'kagaz-backup', version: 99 }));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const encrypted = await encryptBackup(bytes, KEY);
    await expect(decryptAndParseBackup(encrypted, KEY)).rejects.toThrow(/unsupported backup version/i);
  });
});

describe('applyBackup (restore, SEC-V1 #11)', () => {
  it('restores documents and folders additively with fresh ids, remapping folderId', async () => {
    const { deps, written: exportWritten } = makeDeps();
    const backupResult = await createBackup(deps);
    const container = exportWritten.get(backupResult.path)!;
    const parsed = await decryptAndParseBackup(container, KEY);

    // Give the manifest's documents a folderId so remap is actually exercised.
    parsed.manifest.documents.forEach((d) => {
      d.folderId = 'f1';
    });

    const { deps: restoreDeps, createdFolders, createdDocuments, written } = makeRestoreDeps();
    const result = await applyBackup(parsed, restoreDeps);

    expect(result.restoredFolders).toBe(1);
    expect(result.restoredDocuments).toBe(2);
    expect(result.skippedDocuments).toEqual([]);
    expect(createdFolders).toEqual([
      { name: 'Personal', parentId: undefined, icon: undefined, color: undefined, sortOrder: 0 },
    ]);
    // Both documents' folderId was remapped from the manifest's original
    // folder id ('f1') to the freshly-created folder's real id.
    expect(createdDocuments.every((d) => d.folderId === 'new-folder-1')).toBe(true);
    expect(createdDocuments.map((d) => d.name).sort()).toEqual(['Doc a', 'Doc b']);
    // Each document's bytes were written to a brand-new documents/ path, not
    // the original archive path.
    expect([...written.keys()].every((p) => p.startsWith('documents/'))).toBe(true);
    expect([...written.keys()]).not.toContain('documents/a.pdf');
  });

  it('restores nested folders parent-first so the child gets the remapped parent id', async () => {
    const parent: FolderEntity = {
      id: 'p1',
      name: 'Parent',
      sortOrder: 0,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    };
    const child: FolderEntity = {
      id: 'c1',
      name: 'Child',
      parentId: 'p1',
      sortOrder: 0,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    };
    // Deliberately listed child-before-parent — applyBackup must still
    // resolve the parent first.
    const manifest = buildBackupManifest([], [child, parent], '2026-07-10T00:00:00Z');
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));

    const { deps: restoreDeps, createdFolders } = makeRestoreDeps();
    await applyBackup({ manifest, zip }, restoreDeps);

    expect(createdFolders[0].name).toBe('Parent');
    expect(createdFolders[1]).toEqual({
      name: 'Child',
      parentId: 'new-folder-1',
      icon: undefined,
      color: undefined,
      sortOrder: 0,
    });
  });

  it('skips a document whose file is missing from the archive, without aborting the rest', async () => {
    const manifest = buildBackupManifest(
      [doc('a', 'documents/a.pdf'), doc('b', 'documents/missing.pdf')],
      [],
      '2026-07-10T00:00:00Z'
    );
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));
    zip.file('documents/a.pdf', 'AAA');
    // documents/missing.pdf deliberately not added.

    const { deps: restoreDeps, createdDocuments } = makeRestoreDeps();
    const result = await applyBackup({ manifest, zip }, restoreDeps);

    expect(result.restoredDocuments).toBe(1);
    expect(result.skippedDocuments).toEqual(['Doc b']);
    expect(createdDocuments).toHaveLength(1);
    expect(createdDocuments[0].name).toBe('Doc a');
  });

  it('treats a document with no folderId as root-level', async () => {
    const manifest = buildBackupManifest([doc('a', 'documents/a.pdf')], [], '2026-07-10T00:00:00Z');
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));
    zip.file('documents/a.pdf', 'AAA');

    const { deps: restoreDeps, createdDocuments } = makeRestoreDeps();
    await applyBackup({ manifest, zip }, restoreDeps);

    expect(createdDocuments[0].folderId).toBeUndefined();
  });
});
