/**
 * Finds document names inside an assistant reply so they can be shown as
 * links (smart UI plan §5). Pure and synchronous: the candidate list is the
 * user's own unlocked vault documents, already loaded by the chat screen.
 *
 * Matching: case-insensitive, whole words (letters/digits of any script on
 * either side end a match), an optional file extension after the name
 * ("Merged document.pdf"), longest name first so "PAN Card back" wins over
 * "PAN Card". Names shorter than {@link MIN_NAME_LENGTH} are skipped — too
 * likely to be ordinary words.
 */
export const MIN_NAME_LENGTH = 3;

/** The minimum a linkable document needs. */
export interface MentionCandidate {
  id: string;
  name: string;
}

/** A run of plain text, or a mention of a document. */
export type MentionSegment<T extends MentionCandidate> = string | { doc: T; text: string };

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Splits `text` into plain runs and document mentions, in order. */
export function splitByDocNames<T extends MentionCandidate>(
  text: string,
  docs: readonly T[]
): MentionSegment<T>[] {
  const usable = docs
    .filter((d) => d.name.trim().length >= MIN_NAME_LENGTH)
    .sort((a, b) => b.name.length - a.name.length);
  if (!text || usable.length === 0) {
    return text ? [text] : [];
  }
  const byName = new Map(usable.map((d) => [d.name.trim().toLowerCase(), d]));
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${[...byName.keys()].map(escape).join('|')})(?:\\.[a-z0-9]{2,5})?(?![\\p{L}\\p{N}])`,
    'giu'
  );
  const out: MentionSegment<T>[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const doc = byName.get(match[1].toLowerCase());
    if (!doc || match.index === undefined) continue;
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push({ doc, text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
