import type { IconName } from '@kagaz/ui';

/** The PDF Tools operations the hub offers (one card each). */
export type PdfOpId =
  | 'merge'
  | 'split'
  | 'compress'
  | 'pdfToImages'
  | 'imagesToPdf'
  | 'encrypt'
  | 'decrypt'
  | 'fillForm';

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
  { id: 'compress', icon: 'Shrink', input: 'pdf-single' },
  { id: 'pdfToImages', icon: 'FileImage', input: 'pdf-single' },
  { id: 'imagesToPdf', icon: 'Images', input: 'images' },
  { id: 'encrypt', icon: 'Lock', input: 'pdf-single' },
  { id: 'decrypt', icon: 'Unlock', input: 'pdf-single' },
  { id: 'fillForm', icon: 'FileOutput', input: 'pdf-single' },
];

/** Image file types accepted by images → PDF. */
export const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png']);
