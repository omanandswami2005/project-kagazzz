/**
 * Resolves the document reference a tool call carries. The on-device model is
 * told to pass the `docN` alias from a tool result, but a 2B model often passes
 * the document's NAME instead ("rent agreement"), or asks the user for an id.
 * Accepting a name here means neither the model nor the user ever has to know
 * an id: the id is tried first, then an exact (case-insensitive) name, then a
 * name containing every word of the reference. Several equally good matches
 * fail with the candidate NAMES listed (no ids: the message is also shown to
 * the user), so the model can ask which one and retry with the exact name.
 */
import { z } from 'zod';
import type { DocumentEntity } from '@/infrastructure/database/types';

/** Tool-arg schema for one document: the alias from a tool result, or a name. */
export const docRefSchema = z
  .string()
  .min(1)
  .describe('The doc alias (e.g. "doc3") from a tool result, or the document name');

/** Tool-arg schema for several documents, in order. */
export const docRefsSchema = z
  .array(docRefSchema)
  .describe('Doc aliases (e.g. "doc3") or document names, in order');

/** Lookups the resolver needs (a DocumentDao satisfies this). */
export interface DocumentLookup {
  findById: (id: string) => Promise<DocumentEntity | null>;
  /** Every non-trashed document. */
  findAll: () => Promise<DocumentEntity[]>;
}

/** Most candidates listed in an "ambiguous" error. */
const MAX_LISTED = 5;

/** Lowercases, drops a file extension, quotes and extra spaces. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, '')
    .replace(/["'`]/g, '')
    .replace(/[_\-\s]+/g, ' ')
    .trim();
}

function ambiguous(ref: string, matches: DocumentEntity[]): Error {
  const listed = matches
    .slice(0, MAX_LISTED)
    .map((d) => `"${d.name}"`)
    .join(', ');
  return new Error(
    `Several documents match "${ref}": ${listed}. Ask the user which one with ai.askUser.`
  );
}

/**
 * Finds the document an id or a name refers to.
 * @throws when nothing matches, or when several documents match equally well.
 */
export async function resolveDocumentRef(
  lookup: DocumentLookup,
  ref: string
): Promise<DocumentEntity> {
  const byId = await lookup.findById(ref);
  if (byId) {
    return byId;
  }
  const wanted = normalize(ref);
  if (!wanted) {
    throw new Error('No document was given');
  }
  const all = await lookup.findAll();

  const exact = all.filter((d) => normalize(d.name) === wanted);
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    throw ambiguous(ref, exact);
  }

  const words = wanted.split(' ');
  const partial = all.filter((d) => {
    const name = normalize(d.name);
    return words.every((w) => name.includes(w));
  });
  if (partial.length === 1) {
    return partial[0];
  }
  if (partial.length > 1) {
    throw ambiguous(ref, partial);
  }
  throw new Error(
    `No document is called "${ref}". Call ai.searchDocuments with one keyword to find it.`
  );
}
