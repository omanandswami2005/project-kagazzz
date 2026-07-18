import { describe, expect, it, vi } from 'vitest';
import type { NewDocument } from '@/infrastructure/database/types';
import {
  DocumentVaultError,
  VaultErrorCode,
  type UploadProgress,
} from '../../types/document.types';
import { UploadService, mimeTypeFor } from '../upload.service';
import {
  MemoryFileStorage,
  blobOf,
  entityFromNew,
  heicBytes,
  incoming,
  jpgBytes,
  pdfBytes,
  pngBytes,
} from '../../__tests__/fixtures/vault-fixtures';

function makeService(overrides?: {
  storage?: MemoryFileStorage;
  createImpl?: (doc: NewDocument) => Promise<ReturnType<typeof entityFromNew>>;
  convertHeic?: (blob: Blob) => Promise<Blob>;
  makeThumbnail?: (blob: Blob, fileType: string) => Promise<Uint8Array | null>;
}): {
  service: UploadService;
  storage: MemoryFileStorage;
  create: ReturnType<typeof vi.fn>;
} {
  const storage = overrides?.storage ?? new MemoryFileStorage();
  const create = vi.fn(
    overrides?.createImpl ??
      ((doc: NewDocument) => Promise.resolve(entityFromNew(doc)))
  );
  const service = new UploadService({
    storage,
    documents: { create },
    convertHeic: overrides?.convertHeic,
    makeThumbnail: overrides?.makeThumbnail,
  });
  return { service, storage, create };
}

describe('UploadService.processFile', () => {
  it('saves a PDF, hashes it, and inserts the documents row', async () => {
    const { service, storage, create } = makeService();
    const document = await service.processFile(
      incoming('My Tax 2025.pdf', pdfBytes()),
      { folderId: 'folder-9' }
    );

    expect(document.name).toBe('My Tax 2025');
    expect(create).toHaveBeenCalledOnce();
    const row = create.mock.calls[0]?.[0] as NewDocument;
    expect(row.fileType).toBe('pdf');
    expect(row.folderId).toBe('folder-9');
    expect(row.sourceType).toBe('file_picker');
    expect(row.originalFilename).toBe('My Tax 2025.pdf');
    expect(row.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.filePath).toMatch(/^documents\/[0-9a-f-]+\.pdf$/);
    expect(storage.files.has(row.filePath)).toBe(true);
  });

  it('generates + caches a thumbnail and links it on the row (F-24)', async () => {
    const makeThumbnail = vi.fn(() =>
      Promise.resolve(new Uint8Array([1, 2, 3]))
    );
    const { service, storage, create } = makeService({ makeThumbnail });
    await service.processFile(incoming('a.png', pngBytes()), {});

    expect(makeThumbnail).toHaveBeenCalledOnce();
    const row = create.mock.calls[0]?.[0] as NewDocument;
    expect(row.thumbnailPath).toMatch(/^thumbnails\/[0-9a-f-]+\.jpg$/);
    expect(storage.files.has(row.thumbnailPath ?? '')).toBe(true);
  });

  it('a thumbnail failure is non-fatal (no thumbnailPath)', async () => {
    const makeThumbnail = vi.fn(() => Promise.reject(new Error('canvas boom')));
    const { service, create } = makeService({ makeThumbnail });
    await service.processFile(incoming('a.png', pngBytes()), {});
    const row = create.mock.calls[0]?.[0] as NewDocument;
    expect(row.thumbnailPath).toBeUndefined();
  });

  it('skips the thumbnail when the maker returns null', async () => {
    const makeThumbnail = vi.fn(() => Promise.resolve(null));
    const { service, create } = makeService({ makeThumbnail });
    await service.processFile(incoming('a.pdf', pdfBytes()), {});
    const row = create.mock.calls[0]?.[0] as NewDocument;
    expect(row.thumbnailPath).toBeUndefined();
  });

  it('stores HEIC as-is until F-8 provides a converter', async () => {
    const { service, create } = makeService();
    await service.processFile(incoming('IMG_002.heic', heicBytes()), {});
    const row = create.mock.calls[0]?.[0] as NewDocument;
    expect(row.fileType).toBe('heic');
    expect(row.filePath).toMatch(/\.heic$/);
  });

  it('converts HEIC to JPEG when a converter is wired (F-8)', async () => {
    const convertHeic = vi.fn(() =>
      Promise.resolve(blobOf(jpgBytes()))
    );
    const { service, create } = makeService({ convertHeic });
    await service.processFile(incoming('IMG_001.heic', heicBytes()), {});

    expect(convertHeic).toHaveBeenCalledOnce();
    const row = create.mock.calls[0]?.[0] as NewDocument;
    expect(row.fileType).toBe('jpg');
    expect(row.filePath).toMatch(/\.jpg$/);
    expect(row.originalFilename).toBe('IMG_001.heic');
  });

  it('maps a failing HEIC conversion to CONVERSION_FAILED', async () => {
    const { service } = makeService({
      convertHeic: () => Promise.reject(new Error('wasm crashed')),
    });
    await expect(
      service.processFile(incoming('a.heic', heicBytes()), {})
    ).rejects.toMatchObject({ code: VaultErrorCode.CONVERSION_FAILED });
  });

  it('rejects invalid files with the validation code', async () => {
    const { service, create } = makeService();
    await expect(
      service.processFile(incoming('fake.pdf', pngBytes()), {})
    ).rejects.toMatchObject({ code: VaultErrorCode.CORRUPTED_FILE });
    expect(create).not.toHaveBeenCalled();
  });

  it('fails with STORAGE_FULL when the device is out of space', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: () => Promise.resolve({ quota: 10, usage: 9 }) },
    });
    try {
      const { service } = makeService();
      await expect(
        service.processFile(incoming('a.pdf', pdfBytes()), {})
      ).rejects.toMatchObject({ code: VaultErrorCode.STORAGE_FULL });
    } finally {
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: undefined,
      });
    }
  });

  it('maps storage write failures to FILE_WRITE_ERROR', async () => {
    const storage = new MemoryFileStorage();
    storage.failWrite = new Error('disk detached');
    const { service, create } = makeService({ storage });
    await expect(
      service.processFile(incoming('a.pdf', pdfBytes()), {})
    ).rejects.toMatchObject({ code: VaultErrorCode.FILE_WRITE_ERROR });
    expect(create).not.toHaveBeenCalled();
  });

  it('removes the orphaned file when the DB insert fails', async () => {
    const storage = new MemoryFileStorage();
    const { service } = makeService({
      storage,
      createImpl: () => Promise.reject(new Error('SQLITE_BUSY')),
    });
    await expect(
      service.processFile(incoming('a.pdf', pdfBytes()), {})
    ).rejects.toMatchObject({ code: VaultErrorCode.DB_QUERY_ERROR });
    expect(storage.files.size).toBe(0);
  });
});

describe('UploadService.uploadFiles', () => {
  it('continues the batch when one file fails and reports both', async () => {
    const { service } = makeService();
    const result = await service.uploadFiles([
      incoming('good.pdf', pdfBytes()),
      incoming('bad.exe', pdfBytes()),
    ]);

    expect(result.documents).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.fileName).toBe('bad.exe');
    expect(result.failures[0]?.error).toBeInstanceOf(DocumentVaultError);
    expect(result.failures[0]?.error.code).toBe(
      VaultErrorCode.INVALID_FILE_TYPE
    );
  });

  it('wraps unexpected errors into FILE_READ_ERROR', async () => {
    const { service } = makeService();
    // Make processFile throw a non-DocumentVaultError by breaking the blob.
    const broken = {
      name: 'a.pdf',
      blob: {
        size: 10,
        slice: () => {
          throw new Error('unreadable');
        },
      } as unknown as Blob,
      source: 'file_picker' as const,
    };
    const result = await service.uploadFiles([broken]);
    expect(result.failures[0]?.error.code).toBe(
      VaultErrorCode.FILE_READ_ERROR
    );
  });

  it('emits monotonic progress through the stages', async () => {
    const { service } = makeService();
    const events: UploadProgress[] = [];
    service.onProgress((progress) => events.push(progress));

    await service.uploadFiles([
      incoming('a.pdf', pdfBytes()),
      incoming('b.png', pngBytes()),
    ]);

    expect(events.map((e) => e.stage)).toEqual([
      'validating',
      'saving',
      'complete',
      'validating',
      'saving',
      'complete',
    ]);
    const percents = events.map((e) => e.progress);
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
    expect(events.at(-1)?.progress).toBe(100);
    expect(events[0]?.totalFiles).toBe(2);
  });
});

describe('mimeTypeFor', () => {
  it('maps known types and falls back to octet-stream', () => {
    expect(mimeTypeFor('pdf')).toBe('application/pdf');
    expect(mimeTypeFor('jpg')).toBe('image/jpeg');
    expect(mimeTypeFor('weird')).toBe('application/octet-stream');
  });
});
