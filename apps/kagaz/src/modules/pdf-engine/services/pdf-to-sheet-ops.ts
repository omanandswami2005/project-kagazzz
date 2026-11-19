/**
 * PDF → spreadsheet generation (F-42). Writes rows to a `.xlsx` or `.csv`
 * Blob. Row extraction is table-first: form fields become Field/Value rows,
 * otherwise text lines are split on column gaps.
 *
 * The .xlsx is written directly — a minimal SpreadsheetML package (one sheet,
 * inline strings) zipped with JSZip, which the app already ships for backups.
 * SheetJS `xlsx` was dropped (2026-11-19 audit): npm's last release, 0.18.5,
 * carries two high advisories whose fixes exist only on SheetJS's own CDN,
 * and this feature only ever *writes* a sheet.
 *
 * [SEC] the rows are document content; this module never logs them. In CSV,
 * cells a spreadsheet would run as a formula (=, +, -, @, tab, CR — not plain
 * numbers) get a leading `'`, so a PDF can't smuggle a formula into the
 * user's Excel. .xlsx cells are inline strings, never evaluated.
 */

/** Spreadsheet output formats offered by F-42. */
export type SheetFormat = 'xlsx' | 'csv';

const SHEET_MIME: Record<SheetFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

/**
 * Splits one text line into cells on runs of two-or-more spaces or a tab — a
 * crude column detector for text-layout tables (F-42 fallback path).
 */
export function splitRow(line: string): string[] {
  return line.split(/\t|\s{2,}/).map((cell) => cell.trim());
}

/**
 * True when a spreadsheet app would evaluate the CSV cell as a formula (CSV
 * injection). Plain numbers ("-500", "+91") are left alone.
 */
function looksLikeFormula(cell: string): boolean {
  return /^[=+\-@\t\r]/.test(cell) && !/^[-+]?[\d.,\s]+$/.test(cell);
}

/** One CSV field (RFC 4180): formula-looking cells get a leading `'`; quoted when needed. */
function csvField(cell: string): string {
  const safe = looksLikeFormula(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Characters XML 1.0 can't hold at all (control codes) are dropped. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function xmlText(value: string): string {
  return value
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Spreadsheet column letters for a 0-based index: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** The worksheet XML: every cell an inline string (no shared-strings part needed). */
function sheetXml(rows: string[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) =>
          cell === ''
            ? ''
            : `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlText(cell)}</t></is></c>`
        )
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}"><sheetData>${body}</sheetData></worksheet>`;
}

async function buildXlsx(rows: string[][]): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>'
  );
  zip.file(
    '_rels/.rels',
    `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );
  zip.file(
    'xl/workbook.xml',
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
      '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
  );
  zip.file('xl/worksheets/sheet1.xml', sheetXml(rows));
  const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return new Blob([data as BlobPart], { type: SHEET_MIME.xlsx });
}

/** Builds an `.xlsx`/`.csv` Blob from a 2-D array of cell strings (F-42). */
export async function buildSheet(rows: string[][], format: SheetFormat): Promise<Blob> {
  if (format === 'xlsx') return buildXlsx(rows);
  // UTF-8 BOM so Excel reads Hindi (and any non-ASCII) text correctly.
  const csv = rows.map((row) => row.map(csvField).join(',')).join('\r\n');
  return new Blob(['\uFEFF', csv, '\r\n'], { type: SHEET_MIME.csv });
}
