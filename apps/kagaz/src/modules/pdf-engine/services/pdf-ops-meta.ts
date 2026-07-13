import type { IconName } from '@kagaz/ui';

/** The PDF Tools operations the hub offers (one card each). */
export type PdfOpId =
  | 'merge'
  | 'split'
  | 'organize'
  | 'compress'
  | 'pdfToImages'
  | 'pdfToText'
  | 'pdfToWord'
  | 'imagesToPdf'
  | 'watermark'
  | 'stamp'
  | 'pageNumbers'
  | 'encrypt'
  | 'decrypt'
  | 'fillForm'
  | 'metadata';

/** What kind of vault documents an operation takes as input. */
export type PdfOpInput = 'pdf-single' | 'pdf-multi' | 'images';

/** Display + input metadata for one operation. */
export interface PdfOpMeta {
  id: PdfOpId;
  icon: IconName;
  input: PdfOpInput;
}

/** The operations, in the order shown on the hub. */
export const PDF_OPS: readonly PdfOpMeta[] = [
  { id: 'merge', icon: 'Combine', input: 'pdf-multi' },
  { id: 'split', icon: 'Split', input: 'pdf-single' },
  { id: 'organize', icon: 'LayoutGrid', input: 'pdf-single' },
  { id: 'compress', icon: 'Shrink', input: 'pdf-single' },
  { id: 'pdfToImages', icon: 'FileImage', input: 'pdf-single' },
  { id: 'pdfToText', icon: 'FileText', input: 'pdf-single' },
  { id: 'pdfToWord', icon: 'FileType', input: 'pdf-single' },
  { id: 'imagesToPdf', icon: 'Images', input: 'images' },
  { id: 'watermark', icon: 'Pencil', input: 'pdf-single' },
  { id: 'stamp', icon: 'Stamp', input: 'pdf-single' },
  { id: 'pageNumbers', icon: 'Hash', input: 'pdf-single' },
  { id: 'encrypt', icon: 'Lock', input: 'pdf-single' },
  { id: 'decrypt', icon: 'Unlock', input: 'pdf-single' },
  { id: 'fillForm', icon: 'FileOutput', input: 'pdf-single' },
  { id: 'metadata', icon: 'Info', input: 'pdf-single' },
];

/** Image file types accepted by images → PDF. */
export const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png']);
