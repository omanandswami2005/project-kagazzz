/**
 * FTS5 query builder (02-document-vault-module.md §Search Engine,
 * 09-database-design.md FTS5). Turns free-text input into a safe FTS5
 * MATCH expression — raw input can contain FTS5 operators (", *, (), :,
 * ^, NEAR) that would throw a syntax error if passed through.
 *
 * Lives in infrastructure/database/ (not the search module) because it's
 * pure SQLite-FTS5-syntax logic with two consumers in different modules
 * (search's own useSearch.ts, and ai-assistant's search_documents tool) —
 * moved here from search/services/search.service.ts the moment the
 * second consumer appeared, per the protocol-based design rule (modules
 * never import another module's concrete implementation; shared code
 * comes from core/ or infrastructure/).
 */

/**
 * Builds a prefix-matching FTS5 query from user input, or null when the
 * input has no searchable tokens. Each token is stripped to letters and
 * numbers (Unicode-aware, so Hindi/Devanagari works), then suffixed with
 * `*` for prefix matching; tokens combine with implicit AND.
 *
 * `"aadh card"` → `aadh* card*`
 */
export function buildFtsMatchQuery(raw: string): string | null {
  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    // Keep letters, numbers, and combining marks (\p{M}) — Devanagari
    // matras (e.g. the ा in आधार) are marks, not letters.
    .map((token) => token.replace(/[^\p{L}\p{N}\p{M}]/gu, ''))
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return null;
  }
  return tokens.map((token) => `${token}*`).join(' ');
}

/** Minimum characters before a search fires (avoids matching everything). */
export const MIN_SEARCH_LENGTH = 2;

/** True when the trimmed query is long enough to search. */
export function isSearchable(raw: string): boolean {
  return raw.trim().length >= MIN_SEARCH_LENGTH;
}
