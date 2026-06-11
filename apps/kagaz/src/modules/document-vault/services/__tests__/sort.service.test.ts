import { describe, expect, it } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';
import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEY,
  SORT_KEYS,
  sortDocuments,
} from '../sort.service';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';

function doc(
  id: string,
  over: Partial<DocumentEntity> = {}
): DocumentEntity {
  return {
    ...entityFromNew(
      {
        name: id,
        filePath: `documents/${id}.pdf`,
        fileType: 'pdf',
        fileSize: 1,
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

describe('sortDocuments', () => {
  it('sorts by name ascending and descending', () => {
    const docs = [doc('b'), doc('a'), doc('c')];
    expect(sortDocuments(docs, 'name', 'asc').map((d) => d.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(sortDocuments(docs, 'name', 'desc').map((d) => d.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('sorts by file size numerically (not lexically)', () => {
    const docs = [
      doc('big', { fileSize: 1000 }),
      doc('small', { fileSize: 9 }),
      doc('mid', { fileSize: 100 }),
    ];
    expect(sortDocuments(docs, 'fileSize', 'asc').map((d) => d.id)).toEqual([
      'small',
      'mid',
      'big',
    ]);
  });

  it('sorts by createdAt', () => {
    const docs = [
      doc('old', { createdAt: '2026-01-01T00:00:00.000Z' }),
      doc('new', { createdAt: '2026-06-01T00:00:00.000Z' }),
    ];
    expect(sortDocuments(docs, 'createdAt', 'desc').map((d) => d.id)).toEqual([
      'new',
      'old',
    ]);
  });

  it('sorts by lastAccessedAt, never-opened last when ascending (F-32)', () => {
    const docs = [
      doc('opened', { lastAccessedAt: '2026-06-05T00:00:00.000Z' }),
      doc('never'),
    ];
    expect(
      sortDocuments(docs, 'lastAccessedAt', 'asc').map((d) => d.id)
    ).toEqual(['never', 'opened']);
  });

  it('is stable via id tiebreaker and does not mutate the input', () => {
    const docs = [doc('b'), doc('a')];
    const frozen = [...docs];
    const sorted = sortDocuments(docs, 'fileType', 'asc');
    expect(docs).toEqual(frozen); // input untouched
    expect(sorted.map((d) => d.id)).toEqual(['a', 'b']); // tie broken by id
  });

  it('exposes sane defaults', () => {
    expect(DEFAULT_SORT_KEY).toBe('createdAt');
    expect(DEFAULT_SORT_DIRECTION).toBe('desc');
    expect(SORT_KEYS).toContain('name');
  });
});
