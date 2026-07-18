import { describe, expect, it } from 'vitest';
import { buildStorageStats } from '../storage.service';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';

const big = entityFromNew(
  {
    name: 'big',
    filePath: 'documents/big.pdf',
    fileType: 'pdf',
    fileSize: 8000,
    isFavorite: false,
    isLocked: false,
    isArchived: false,
    language: 'en',
    sourceType: 'file_picker',
  },
  'big'
);

describe('buildStorageStats (F-26)', () => {
  it('computes per-type fractions and carries the rest through', () => {
    const stats = buildStorageStats({
      totals: { totalBytes: 10000, count: 4 },
      usageByType: [
        { fileType: 'pdf', bytes: 8000, count: 2 },
        { fileType: 'jpg', bytes: 2000, count: 2 },
      ],
      largest: [big],
      duplicates: { groups: 1, wastedBytes: 500 },
    });

    expect(stats.totalBytes).toBe(10000);
    expect(stats.documentCount).toBe(4);
    expect(stats.byType[0]?.fraction).toBeCloseTo(0.8);
    expect(stats.byType[1]?.fraction).toBeCloseTo(0.2);
    expect(stats.largest[0]?.id).toBe('big');
    expect(stats.duplicateGroups).toBe(1);
    expect(stats.reclaimableBytes).toBe(500);
  });

  it('avoids divide-by-zero on an empty vault', () => {
    const stats = buildStorageStats({
      totals: { totalBytes: 0, count: 0 },
      usageByType: [],
      largest: [],
      duplicates: { groups: 0, wastedBytes: 0 },
    });
    expect(stats.totalBytes).toBe(0);
    expect(stats.byType).toEqual([]);
  });
});
