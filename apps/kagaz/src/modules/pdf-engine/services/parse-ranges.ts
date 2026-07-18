import type { PageRange } from '../types/pdf-engine.types';

/**
 * Parses a human page-range string ("1-3, 5, 8-10", 1-based inclusive) into
 * the engine's 0-based {@link PageRange}[]. Returns null for any malformed or
 * empty input so the UI can show a single "bad ranges" message.
 */
export function parsePageRanges(input: string): PageRange[] | null {
  const parts = input
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    return null;
  }

  const ranges: PageRange[] = [];
  for (const part of parts) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) {
      return null;
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < start) {
      return null;
    }
    ranges.push({ start: start - 1, end: end - 1 }); // 1-based → 0-based
  }
  return ranges;
}
