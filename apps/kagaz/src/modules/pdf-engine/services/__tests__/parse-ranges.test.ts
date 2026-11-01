import { describe, expect, it } from 'vitest';
import { flattenPageRanges, parsePageRanges } from '../parse-ranges';

describe('parsePageRanges', () => {
  it('parses a single page to a 0-based range', () => {
    expect(parsePageRanges('1')).toEqual([{ start: 0, end: 0 }]);
  });

  it('parses a hyphenated range, converting to 0-based', () => {
    expect(parsePageRanges('1-3')).toEqual([{ start: 0, end: 2 }]);
  });

  it('parses a mixed comma list with spaces', () => {
    expect(parsePageRanges(' 1-3, 5 , 8-10 ')).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 4 },
      { start: 7, end: 9 },
    ]);
  });

  it('ignores empty entries between commas', () => {
    expect(parsePageRanges('1,,2')).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 1 },
    ]);
  });

  it.each(['', '   ', '0', '0-2', '3-1', 'a', '1-', '1.5'])(
    'returns null for invalid input %j',
    (input) => {
      expect(parsePageRanges(input)).toBeNull();
    }
  );
});

describe('flattenPageRanges', () => {
  it('expands a single range to individual indices', () => {
    expect(flattenPageRanges([{ start: 0, end: 2 }])).toEqual([0, 1, 2]);
  });

  it('dedupes overlapping ranges and sorts ascending', () => {
    expect(
      flattenPageRanges([
        { start: 4, end: 4 },
        { start: 0, end: 2 },
        { start: 2, end: 3 },
      ])
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns [] for an empty range list', () => {
    expect(flattenPageRanges([])).toEqual([]);
  });
});
