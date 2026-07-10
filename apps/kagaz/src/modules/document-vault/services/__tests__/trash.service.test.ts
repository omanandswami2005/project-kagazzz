import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';
import {
  TRASH_RETENTION_DAYS,
  deleteForever,
  emptyTrash,
  isExpired,
  purgeExpiredTrash,
  type TrashDeps,
} from '../trash.service';

const NOW = Date.parse('2026-07-10T00:00:00.000Z');
const daysAgo = (n: number): string => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function trashedDoc(id: string, deletedAt: string, thumb?: string): DocumentEntity {
  return {
    id,
    name: id,
    filePath: `documents/${id}.pdf`,
    fileType: 'application/pdf',
    fileSize: 1,
    thumbnailPath: thumb,
    isFavorite: false,
    isLocked: false,
    isArchived: false,
    language: 'en',
    sourceType: 'file_picker',
    createdAt: daysAgo(60),
    updatedAt: deletedAt,
    deletedAt,
    synced: false,
    version: 1,
  };
}

function makeDeps(trashed: DocumentEntity[]): {
  deps: TrashDeps;
  deleted: string[];
  hardDeleted: string[];
} {
  const deleted: string[] = [];
  const hardDeleted: string[] = [];
  return {
    deleted,
    hardDeleted,
    deps: {
      listTrashed: vi.fn(async () => trashed),
      hardDelete: vi.fn(async (id: string) => {
        hardDeleted.push(id);
        return 1;
      }),
      deleteFile: vi.fn(async (path: string) => {
        deleted.push(path);
      }),
      now: () => NOW,
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('isExpired', () => {
  it(`is true only at/after ${TRASH_RETENTION_DAYS} days`, () => {
    expect(isExpired(daysAgo(31), NOW)).toBe(true);
    expect(isExpired(daysAgo(30), NOW)).toBe(true);
    expect(isExpired(daysAgo(29), NOW)).toBe(false);
  });
  it('is false for a missing or unparseable timestamp', () => {
    expect(isExpired(undefined, NOW)).toBe(false);
    expect(isExpired('not-a-date', NOW)).toBe(false);
  });
});

describe('purgeExpiredTrash (F-57)', () => {
  it('purges only documents past the retention window, files then row', async () => {
    const { deps, deleted, hardDeleted } = makeDeps([
      trashedDoc('old', daysAgo(40), 'thumbnails/old.jpg'),
      trashedDoc('fresh', daysAgo(2)),
    ]);
    const { purged } = await purgeExpiredTrash(deps);

    expect(purged).toBe(1);
    expect(hardDeleted).toEqual(['old']);
    expect(deleted).toEqual(['documents/old.pdf', 'thumbnails/old.jpg']);
  });

  it('keeps going when one document fails to purge', async () => {
    const { deps } = makeDeps([trashedDoc('a', daysAgo(40)), trashedDoc('b', daysAgo(40))]);
    (deps.hardDelete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('locked'));
    const { purged } = await purgeExpiredTrash(deps);
    expect(purged).toBe(1); // 'a' failed, 'b' still purged
  });

  it('purges nothing when the trash is all fresh', async () => {
    const { deps, hardDeleted } = makeDeps([trashedDoc('x', daysAgo(1))]);
    expect((await purgeExpiredTrash(deps)).purged).toBe(0);
    expect(hardDeleted).toEqual([]);
  });
});

describe('deleteForever + emptyTrash', () => {
  it('deleteForever removes files and the row of one document', async () => {
    const { deps, deleted, hardDeleted } = makeDeps([]);
    await deleteForever(trashedDoc('one', daysAgo(1), 'thumbnails/one.jpg'), deps);
    expect(deleted).toEqual(['documents/one.pdf', 'thumbnails/one.jpg']);
    expect(hardDeleted).toEqual(['one']);
  });

  it('emptyTrash purges every trashed document regardless of age', async () => {
    const { deps, hardDeleted } = makeDeps([
      trashedDoc('a', daysAgo(1)),
      trashedDoc('b', daysAgo(45)),
    ]);
    expect((await emptyTrash(deps)).purged).toBe(2);
    expect(hardDeleted).toEqual(['a', 'b']);
  });
});
