/**
 * Pulls standalone number sequences (account/ID numbers, phone numbers, PIN
 * codes, dates, amounts, …) out of a document's OCR/extracted text (F-83) so
 * the viewer can offer them as individually copyable chips — a scanned bill
 * or ID often has one number the user actually wants, and drag-selecting it
 * out of a text block is fiddly on a phone.
 *
 * Pure regex over text already shown on screen; extracts nothing new and
 * stores nothing — the source text is already `DocumentEntity.ocrText`.
 */

/** Digit runs of at least 4 digits, allowing internal spaces/hyphens (e.g. "1234 5678 9012"). */
const NUMBER_SEQUENCE_RE = /\d[\d\s-]{2,}\d/g;

/** Minimum digit count (ignoring separators) for a match to count as a "number". */
const MIN_DIGITS = 4;

/**
 * Extracts distinct number-like sequences from `text`, in first-seen order,
 * capped at `max`. Returns `[]` for empty/whitespace-only input.
 */
export function extractNumberSequences(text: string, max = 20): string[] {
  if (!text?.trim()) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.match(NUMBER_SEQUENCE_RE) ?? []) {
    const trimmed = raw.trim();
    const digitCount = (trimmed.match(/\d/g) ?? []).length;
    if (digitCount < MIN_DIGITS || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}
