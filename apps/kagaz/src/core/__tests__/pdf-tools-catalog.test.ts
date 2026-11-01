import { describe, expect, it } from 'vitest';
import { PDF_OPS, searchPdfTools } from '../pdf-tools-catalog';

/** A minimal stand-in for react-i18next's t(), enough for searchPdfTools. */
const t = (key: string): string => {
  const table: Record<string, string> = {
    'ops.merge': 'Merge PDFs',
    'desc.merge': 'Combine several PDFs into one',
    'ops.encrypt': 'Password protect',
    'desc.encrypt': 'Lock a PDF with a password',
    'ops.decrypt': 'Remove password',
    'desc.decrypt': 'Unlock a password-protected PDF',
  };
  return table[key] ?? key;
};

describe('searchPdfTools', () => {
  it('matches on the translated op name', () => {
    const results = searchPdfTools('merge', t, PDF_OPS.slice(0, 1).concat(
      PDF_OPS.filter((op) => op.id === 'encrypt' || op.id === 'decrypt')
    ));
    expect(results.map((op) => op.id)).toEqual(['merge']);
  });

  it('matches on the translated description, not just the name', () => {
    const ops = PDF_OPS.filter((op) => op.id === 'encrypt' || op.id === 'decrypt');
    const results = searchPdfTools('password', t, ops);
    expect(results.map((op) => op.id).sort()).toEqual(['decrypt', 'encrypt']);
  });

  it('is case-insensitive', () => {
    const ops = PDF_OPS.filter((op) => op.id === 'merge');
    expect(searchPdfTools('MERGE', t, ops)).toHaveLength(1);
  });

  it('returns [] for a blank query without scanning ops', () => {
    expect(searchPdfTools('   ', t, PDF_OPS)).toEqual([]);
  });

  it('returns [] when nothing matches', () => {
    const ops = PDF_OPS.filter((op) => op.id === 'merge');
    expect(searchPdfTools('zzznotarealterm', t, ops)).toEqual([]);
  });

  it('defaults to searching the full PDF_OPS catalog', () => {
    expect(searchPdfTools('merge', t).map((op) => op.id)).toEqual(['merge']);
  });
});
