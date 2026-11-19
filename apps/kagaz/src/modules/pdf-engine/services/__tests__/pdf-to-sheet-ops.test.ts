import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildSheet, columnName, splitRow } from '../pdf-to-sheet-ops';

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

describe('spreadsheet writer (SheetJS replaced, 2026-11-19)', () => {
  it('names columns like a spreadsheet', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });

  it('writes a valid SpreadsheetML package with escaped inline strings', async () => {
    const blob = await buildSheet([['Name', 'Notes'], ['Asha & Co <ltd>', '', 'x\u0001y']], 'xlsx');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml'])
    );
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Asha &amp; Co &lt;ltd&gt;</t></is></c>');
    expect(sheet).not.toContain('r="B2"'); // empty cells are skipped
    expect(sheet).toContain('<t xml:space="preserve">xy</t>'); // control characters dropped
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('quotes CSV fields, keeps Hindi readable in Excel, and defuses formulas', async () => {
    const blob = await buildSheet([['a,b', 'say "hi"', '=HYPERLINK("x")', '-500', '@sum', 'नाम']], 'csv');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const text = new TextDecoder().decode(bytes.slice(3));
    expect(text).toBe(`"a,b","say ""hi""","'=HYPERLINK(""x"")",-500,'@sum,नाम\r\n`);
  });
});
