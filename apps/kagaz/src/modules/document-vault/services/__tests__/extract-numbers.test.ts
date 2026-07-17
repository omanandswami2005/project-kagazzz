import { describe, expect, it } from 'vitest';
import { extractNumberSequences } from '../extract-numbers';

describe('extractNumberSequences (F-83)', () => {
  it('returns [] for empty or whitespace-only text', () => {
    expect(extractNumberSequences('')).toEqual([]);
    expect(extractNumberSequences('   ')).toEqual([]);
  });

  it('extracts a spaced ID-style number', () => {
    expect(extractNumberSequences('UID: 1234 5678 9012 issued 2024')).toEqual([
      '1234 5678 9012',
      '2024',
    ]);
  });

  it('drops short runs below the 4-digit threshold', () => {
    expect(extractNumberSequences('Page 1 of 2, invoice 88221')).toEqual(['88221']);
  });

  it('dedupes repeated numbers, keeping first-seen order', () => {
    expect(extractNumberSequences('Ref 555123 ... again Ref 555123')).toEqual(['555123']);
  });

  it('extracts a hyphenated account number', () => {
    expect(extractNumberSequences('Account No: 0012-3456-789')).toEqual(['0012-3456-789']);
  });

  it('caps results at max', () => {
    const text = Array.from({ length: 5 }, (_, i) => `Ref#${i}: 1000${i}.`).join(' ');
    expect(extractNumberSequences(text, 3)).toHaveLength(3);
  });

  it('finds nothing in plain prose with no numbers', () => {
    expect(extractNumberSequences('Government of India, Ministry of Home Affairs')).toEqual([]);
  });
});
