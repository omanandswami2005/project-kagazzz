import { describe, expect, it } from 'vitest';
import type {
  DocumentEntity,
  TagEntity,
} from '@/infrastructure/database/types';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  fileKind,
  inSizeBucket,
  type DocumentFilters,
} from '../filter.service';

function doc(
  id: string,
  over: Partial<DocumentEntity> = {}
): DocumentEntity {
  return {
    ...entityFromNew(
      {
        name: id,
        filePath: `documents/${id}`,
        fileType: 'pdf',
        fileSize: 1024,
        isFavorite: false,
        isLocked: false,
        isArchived: false,
        language: 'en',
        sourceType: 'file_picker',
      },
      id
    ),
    ...over,
  };
}

const noTags = new Map<string, TagEntity[]>();
const filters = (over: Partial<DocumentFilters>): DocumentFilters => ({
  ...EMPTY_FILTERS,
  ...over,
});

describe('fileKind / inSizeBucket', () => {
  it('classifies file kinds', () => {
    expect(fileKind('pdf')).toBe('pdf');
    expect(fileKind('png')).toBe('image');
    expect(fileKind('jpg')).toBe('image');
    expect(fileKind('docx')).toBe('other');
  });

  it('classifies size buckets', () => {
    expect(inSizeBucket(500 * 1024, 'lt1mb')).toBe(true);
    expect(inSizeBucket(3 * 1024 * 1024, '1to5mb')).toBe(true);
    expect(inSizeBucket(10 * 1024 * 1024, '5to25mb')).toBe(true);
    expect(inSizeBucket(40 * 1024 * 1024, 'gt25mb')).toBe(true);
    expect(inSizeBucket(40 * 1024 * 1024, 'lt1mb')).toBe(false);
  });
});

describe('applyFilters', () => {
  const docs = [
    doc('pdf-fav', { fileType: 'pdf', isFavorite: true, fileSize: 2_000_000 }),
    doc('png-big', { fileType: 'png', fileSize: 30_000_000 }),
    doc('jpg-small', { fileType: 'jpg', fileSize: 100_000 }),
  ];

  it('passes everything with empty filters', () => {
    expect(applyFilters(docs, EMPTY_FILTERS, noTags)).toHaveLength(3);
  });

  it('filters by kind (OR within dimension)', () => {
    const out = applyFilters(docs, filters({ kinds: ['image'] }), noTags);
    expect(out.map((d) => d.id)).toEqual(['png-big', 'jpg-small']);
  });

  it('filters favorites only', () => {
    const out = applyFilters(docs, filters({ favoritesOnly: true }), noTags);
    expect(out.map((d) => d.id)).toEqual(['pdf-fav']);
  });

  it('combines dimensions with AND', () => {
    const out = applyFilters(
      docs,
      filters({ kinds: ['image'], sizes: ['gt25mb'] }),
      noTags
    );
    expect(out.map((d) => d.id)).toEqual(['png-big']);
  });

  it('filters by tag membership', () => {
    const tagMap = new Map<string, TagEntity[]>([
      ['jpg-small', [{ id: 't-1', name: 'x', createdAt: '' }]],
    ]);
    const out = applyFilters(docs, filters({ tagIds: ['t-1'] }), tagMap);
    expect(out.map((d) => d.id)).toEqual(['jpg-small']);
  });
});

describe('activeFilterCount', () => {
  it('counts constrained dimensions', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(
      activeFilterCount(
        filters({ kinds: ['pdf', 'image'], favoritesOnly: true })
      )
    ).toBe(3);
  });
});
