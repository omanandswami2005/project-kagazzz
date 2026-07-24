/**
 * PDF Tools operation catalog (F-3..F-28). Lives in `core/` (not
 * `pdf-engine/`) because it has two consumers in different modules —
 * `pdf-engine`'s own Tools hub/op-picker sheet, and `document-vault`'s
 * vault-home search surfacing a matching tool (UX pass 2026-07-24) —
 * moved here the moment the second consumer appeared, per the
 * protocol-based design rule (modules never import another module's
 * concrete implementation; shared code comes from `core/` or
 * `infrastructure/`). Same pattern as `infrastructure/database/fts-query.ts`.
 */
import type { IconName } from '@kagaz/ui';

/** The PDF Tools operations the hub offers (one card each). */
export type PdfOpId =
  | 'merge'
  | 'split'
  | 'extractPages'
  | 'organize'
  | 'compress'
  | 'pdfToImages'
  | 'pdfToText'
  | 'pdfToWord'
  | 'pdfToExcel'
  | 'imagesToPdf'
  | 'watermark'
  | 'stamp'
  | 'pageNumbers'
  | 'encrypt'
  | 'decrypt'
  | 'fillForm'
  | 'appendScan'
  | 'metadata';

/** What kind of vault documents an operation takes as input. */
export type PdfOpInput = 'pdf-single' | 'pdf-multi' | 'images';

/**
 * Category shown as a filter chip on the Tools hub (UX pass 2026-07-24):
 * `image` — the op consumes or produces images; `other` — converts a PDF to
 * a non-PDF, non-image format; `pdf` — everything else (pure PDF
 * manipulation, still the largest group).
 */
export type PdfOpCategory = 'pdf' | 'image' | 'other';

/** Display + input metadata for one operation. */
export interface PdfOpMeta {
  id: PdfOpId;
  icon: IconName;
  input: PdfOpInput;
  category: PdfOpCategory;
  /** Op requires a native platform (e.g. the ML Kit scanner) — hidden on web. */
  native?: boolean;
}

/** The operations, in the order shown on the hub. */
export const PDF_OPS: readonly PdfOpMeta[] = [
  { id: 'merge', icon: 'Combine', input: 'pdf-multi', category: 'pdf' },
  { id: 'split', icon: 'Split', input: 'pdf-single', category: 'pdf' },
  { id: 'extractPages', icon: 'Scissors', input: 'pdf-single', category: 'pdf' },
  { id: 'organize', icon: 'LayoutGrid', input: 'pdf-single', category: 'pdf' },
  { id: 'compress', icon: 'Shrink', input: 'pdf-single', category: 'pdf' },
  { id: 'pdfToImages', icon: 'FileImage', input: 'pdf-single', category: 'image' },
  { id: 'pdfToText', icon: 'FileText', input: 'pdf-single', category: 'other' },
  { id: 'pdfToWord', icon: 'FileType', input: 'pdf-single', category: 'other' },
  { id: 'pdfToExcel', icon: 'FileSpreadsheet', input: 'pdf-single', category: 'other' },
  { id: 'imagesToPdf', icon: 'Images', input: 'images', category: 'image' },
  { id: 'watermark', icon: 'Pencil', input: 'pdf-single', category: 'pdf' },
  { id: 'stamp', icon: 'Stamp', input: 'pdf-single', category: 'pdf' },
  { id: 'pageNumbers', icon: 'Hash', input: 'pdf-single', category: 'pdf' },
  { id: 'encrypt', icon: 'Lock', input: 'pdf-single', category: 'pdf' },
  { id: 'decrypt', icon: 'Unlock', input: 'pdf-single', category: 'pdf' },
  { id: 'fillForm', icon: 'FileOutput', input: 'pdf-single', category: 'pdf' },
  { id: 'appendScan', icon: 'Scan', input: 'pdf-single', category: 'pdf', native: true },
  { id: 'metadata', icon: 'Info', input: 'pdf-single', category: 'pdf' },
];

/** Image file types accepted by images → PDF. */
export const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png']);

/**
 * Matches `query` against each op's translated name/description — the same
 * substring test PdfToolsPage's own search uses, reused by vault-home
 * search so a query like "merge" surfaces the Merge PDFs tool alongside
 * document results. `t` must be bound to the `tools` i18n namespace
 * (`useTranslation('tools').t`) — typed narrowly to just the two key
 * shapes this function actually reads, which i18next's real strict
 * `TFunction<"tools">` is assignable to (a looser `(key: string) => string`
 * is not, since it could be called with a key outside the namespace).
 */
export function searchPdfTools(
  query: string,
  t: (key: `ops.${PdfOpId}` | `desc.${PdfOpId}`) => string,
  ops: readonly PdfOpMeta[] = PDF_OPS
): PdfOpMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ops.filter(
    (op) =>
      t(`ops.${op.id}`).toLowerCase().includes(q) ||
      t(`desc.${op.id}`).toLowerCase().includes(q)
  );
}
