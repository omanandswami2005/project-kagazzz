import { describe, expect, it } from 'vitest';
import {
  buildFtsMatchQuery,
  isSearchable,
  MIN_SEARCH_LENGTH,
} from '../fts-query';

describe('buildFtsMatchQuery', () => {
  it('builds prefix tokens combined with implicit AND', () => {
    expect(buildFtsMatchQuery('aadh card')).toBe('aadh* card*');
  });

  it('lowercases and collapses whitespace', () => {
    expect(buildFtsMatchQuery('  PAN   Card ')).toBe('pan* card*');
  });

  it('strips FTS5 operators that would throw a syntax error', () => {
    // ", *, (), :, ^, - are all removed before matching.
    expect(buildFtsMatchQuery('foo* "bar" (baz) a:b ^c -d')).toBe(
      'foo* bar* baz* ab* c* d*'
    );
  });

  it('keeps Devanagari tokens (Hindi search)', () => {
    expect(buildFtsMatchQuery('आधार')).toBe('आधार*');
  });

  it('returns null when nothing searchable remains', () => {
    expect(buildFtsMatchQuery('   ')).toBeNull();
    expect(buildFtsMatchQuery('*** "" :')).toBeNull();
  });
});

describe('isSearchable', () => {
  it('requires at least the minimum length', () => {
    expect(MIN_SEARCH_LENGTH).toBe(2);
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable('ab')).toBe(true);
    expect(isSearchable('  x ')).toBe(false);
  });
});
