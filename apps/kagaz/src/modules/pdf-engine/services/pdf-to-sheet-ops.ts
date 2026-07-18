/**
 * PDF → spreadsheet generation (F-42). Lazy-loads SheetJS `xlsx` (ADR-020:
 * Apache-2.0, pure-JS, no network/WASM — audited) and writes rows to a `.xlsx`
 * or `.csv` Blob. Row extraction is table-first: form fields become
 * Field/Value rows, otherwise text lines are split on column gaps.
 *
 * [SEC] the rows are document content; this module never logs them.
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

/** Builds an `.xlsx`/`.csv` Blob from a 2-D array of cell strings (F-42). */
export async function buildSheet(rows: string[][], format: SheetFormat): Promise<Blob> {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const data = XLSX.write(workbook, { type: 'array', bookType: format }) as ArrayBuffer;
  return new Blob([data], { type: SHEET_MIME[format] });
}
