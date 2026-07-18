/**
 * PDF metadata read/write (F-39) via pdf-lib. Reads the document info
 * dictionary (title/author/subject/keywords) and writes user-supplied values
 * back. pdf-lib only, offline, no canvas — safe to run in the manipulation
 * worker.
 */
import { loadAndValidatePdf } from './pdf-ops';
import { type PdfMetadata } from '../types/pdf-engine.types';

/** Splits the UI's comma-separated keywords into pdf-lib's string[]. */
function splitKeywords(keywords: string): string[] {
  return keywords
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/** Reads the document metadata into a plain, form-friendly shape (F-39). */
export async function getPdfMetadataImpl(pdf: Uint8Array): Promise<PdfMetadata> {
  const doc = await loadAndValidatePdf(pdf, 'getMetadata');
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '',
  };
}

/**
 * Writes the supplied metadata onto the document and returns the new bytes
 * (F-39). An empty string clears that field. `keywords` is stored as pdf-lib's
 * keyword array (split on commas).
 */
export async function setPdfMetadataImpl(
  pdf: Uint8Array,
  metadata: PdfMetadata
): Promise<Uint8Array> {
  const doc = await loadAndValidatePdf(pdf, 'setMetadata');
  doc.setTitle(metadata.title.trim());
  doc.setAuthor(metadata.author.trim());
  doc.setSubject(metadata.subject.trim());
  doc.setKeywords(splitKeywords(metadata.keywords));
  return doc.save();
}
