/**
 * Shared builders for document-vault tests (the fixtures directory is
 * excluded from vitest test discovery).
 */
import type {
  DocumentEntity,
  NewDocument,
} from '@/infrastructure/database/types';
import type { FileStorage } from '@/infrastructure/filesystem';
import type { IncomingFile } from '../../types/document.types';

/** In-memory FileStorage covering the full protocol. */
export class MemoryFileStorage implements FileStorage {
  readonly files = new Map<string, Uint8Array>();
  /** When set, write() rejects with this error. */
  failWrite: Error | null = null;

  write(path: string, data: Uint8Array): Promise<void> {
    if (this.failWrite) {
      return Promise.reject(this.failWrite);
    }
    this.files.set(path, data);
    return Promise.resolve();
  }

  read(path: string): Promise<Uint8Array> {
    const data = this.files.get(path);
    if (!data) {
      return Promise.reject(new Error(`missing: ${path}`));
    }
    return Promise.resolve(data);
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }

  delete(path: string): Promise<void> {
    this.files.delete(path);
    return Promise.resolve();
  }

  list(dir: string): Promise<string[]> {
    return Promise.resolve(
      [...this.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`))
        .map((p) => p.slice(dir.length + 1))
    );
  }

  size(path: string): Promise<number> {
    return this.read(path).then((d) => d.byteLength);
  }

  clearDirectory(dir: string): Promise<void> {
    for (const path of [...this.files.keys()]) {
      if (path.startsWith(`${dir}/`)) {
        this.files.delete(path);
      }
    }
    return Promise.resolve();
  }
}

/** Builds a full DocumentEntity from a NewDocument (fake DAO create). */
export function entityFromNew(
  doc: NewDocument,
  id = 'doc-1'
): DocumentEntity {
  return {
    ...doc,
    id,
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
    synced: false,
    version: 1,
  };
}

/** A stored documents row in DAO snake_case shape (FakeDb queries). */
export function docRow(overrides: Record<string, unknown> = {}): {
  [key: string]: unknown;
} {
  return {
    id: 'doc-1',
    name: 'Aadhaar',
    description: null,
    file_path: 'documents/doc-1.pdf',
    file_type: 'pdf',
    file_size: 1234,
    file_hash: 'abc',
    thumbnail_path: null,
    folder_id: null,
    is_favorite: 0,
    is_locked: 0,
    is_archived: 0,
    language: 'en',
    ocr_text: null,
    source_type: 'file_picker',
    original_filename: 'Aadhaar.pdf',
    created_at: '2026-06-11T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
    deleted_at: null,
    metadata_json: null,
    synced: 0,
    version: 1,
    ...overrides,
  };
}

/** Minimal valid PDF bytes (magic header + padding). */
export function pdfBytes(size = 64): Uint8Array {
  const data = new Uint8Array(size);
  data.set([0x25, 0x50, 0x44, 0x46]); // %PDF
  return data;
}

/** Minimal valid PNG header bytes. */
export function pngBytes(size = 64): Uint8Array {
  const data = new Uint8Array(size);
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return data;
}

/** Minimal valid JPEG header bytes. */
export function jpgBytes(size = 64): Uint8Array {
  const data = new Uint8Array(size);
  data.set([0xff, 0xd8, 0xff, 0xe0]);
  return data;
}

/** Minimal HEIC header bytes (ftyp + heic brand at offset 4). */
export function heicBytes(size = 64): Uint8Array {
  const data = new Uint8Array(size);
  data.set([0, 0, 0, 24]);
  data.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
  data.set([0x68, 0x65, 0x69, 0x63], 8); // heic
  return data;
}

/** Minimal WEBP header bytes (RIFF....WEBP). */
export function webpBytes(size = 64): Uint8Array {
  const data = new Uint8Array(size);
  data.set([0x52, 0x49, 0x46, 0x46]); // RIFF
  data.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return data;
}

/** Wraps bytes in a Blob (copies into a plain ArrayBuffer for TS dom types). */
export function blobOf(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer]);
}

/** Wraps bytes as an IncomingFile. */
export function incoming(
  name: string,
  bytes: Uint8Array,
  source: IncomingFile['source'] = 'file_picker'
): IncomingFile {
  return { name, blob: blobOf(bytes), source };
}
