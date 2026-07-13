import { describe, expect, it } from 'vitest';
import { buildSheet, splitRow } from '../pdf-to-sheet-ops';

describe('splitRow (F-42)', () => {
  it('splits on runs of two or more spaces', () => {
    expect(splitRow('Name    Asha    Age    30')).toEqual(['Name', 'Asha', 'Age', '30']);
  });

  it('splits on tabs and trims cells', () => {
    expect(splitRow('a\t b \tc')).toEqual(['a', 'b', 'c']);
  });

  it('keeps a single-spaced line as one cell', () => {
    expect(splitRow('one two three')).toEqual(['one two three']);
  });
});

describe('buildSheet (F-42)', () => {
  it('produces a non-empty .xlsx (ZIP) Blob', async () => {
    const blob = await buildSheet(
      [
        ['Field', 'Value'],
        ['Name', 'Asha'],
      ],
      'xlsx'
    );
    expect(blob.size).toBeGreaterThan(0);
    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    expect(Array.from(header)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('produces CSV text', async () => {
    const blob = await buildSheet(
      [
        ['a', 'b'],
        ['1', '2'],
      ],
      'csv'
    );
    const text = await blob.text();
    expect(text).toContain('a,b');
    expect(text).toContain('1,2');
  });
});
