/**
 * Keyword search inside the text already extracted from documents (OCR / PDF
 * layer, stored in `documents.ocr_text` and indexed by the vault's FTS), plus
 * reading a document's text. Needs no embedding model: it is what lets the
 * assistant answer "what is the mobile number on the Rover card?".
 *
 * [SEC] Like semantic search, this hands document *content* to the model (the
 * on-device one; the cloud one only in demo builds). Locked documents are never
 * searched or read. Full spec of the boundary: 10-security-architecture.md §5.
 */
import type { DocumentEntity } from '@/infrastructure/database/types';

export interface TextMatch {
  documentId: string;
  name: string;
  /** Text around the first hit; empty when only the file name matched. */
  snippet: string;
}

export interface DocumentText {
  documentId: string;
  name: string;
  text: string;
  truncated: boolean;
}

const SNIPPET_RADIUS = 140;
const MAX_TEXT_CHARS = 6000;
/** Words that say what the user wants, not what to look for. */
const FILLER = new Set([
  'the',
  'and',
  'for',
  'what',
  'whats',
  'which',
  'with',
  'from',
  'that',
  'this',
  'have',
  'has',
  'number',
  'mobile',
  'phone',
  'find',
  'show',
  'give',
  'tell',
  'my',
  'me',
  'of',
  'in',
  'on',
  'is',
  'document',
  'card',
  'file',
]);

/** Search terms: the whole query first, then each meaningful word. */
export function searchTerms(query: string): string[] {
  const words =
    query
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}]+/gu)
      ?.filter((w) => w.length >= 3 && !FILLER.has(w)) ?? [];
  return [...new Set([query.trim(), ...words])].filter(Boolean);
}

function snippetAround(text: string, term: string): string {
  const clean = text.replace(/\s+/g, ' ');
  const at = clean.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) {
    return '';
  }
  const start = Math.max(0, at - SNIPPET_RADIUS);
  return `${start > 0 ? '…' : ''}${clean.slice(start, at + term.length + SNIPPET_RADIUS)}…`;
}

export async function findInDocumentText(
  deps: { search: (term: string) => Promise<DocumentEntity[]> },
  query: string,
  limit: number
): Promise<TextMatch[]> {
  const scored = new Map<string, { doc: DocumentEntity; hits: number; term: string }>();
  for (const term of searchTerms(query)) {
    for (const doc of await deps.search(term)) {
      if (doc.isLocked) {
        continue;
      }
      const entry = scored.get(doc.id) ?? { doc, hits: 0, term };
      entry.hits++;
      scored.set(doc.id, entry);
    }
  }
  return [...scored.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map(({ doc, term }) => ({
      documentId: doc.id,
      name: doc.name,
      snippet: snippetAround(doc.ocrText ?? '', term),
    }));
}

export async function readDocumentText(
  doc: DocumentEntity,
  extractText: (doc: DocumentEntity) => Promise<string | null>
): Promise<DocumentText> {
  const text = doc.ocrText?.trim() || (await extractText(doc))?.trim();
  if (!text) {
    throw new Error('No text could be read from this document');
  }
  return {
    documentId: doc.id,
    name: doc.name,
    text: text.slice(0, MAX_TEXT_CHARS),
    truncated: text.length > MAX_TEXT_CHARS,
  };
}
