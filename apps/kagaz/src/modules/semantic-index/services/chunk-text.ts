/**
 * Splits text into overlapping character windows, preferring to break at
 * whitespace. Sized for an embedding model's input limit, not for meaning —
 * KISS until retrieval quality shows it matters.
 */
export function chunkText(text: string, size = 800, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) {
    return [];
  }
  if (clean.length <= size) {
    return [clean];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end);
      if (lastSpace > start + overlap) {
        end = lastSpace;
      }
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) {
      break;
    }
    start = end - overlap;
  }
  return chunks;
}
