/**
 * Word (.docx) → viewable HTML (F-43). Lazy-loads `mammoth` (ADR-020: BSD-2,
 * pure-JS browser build, no network/WASM — audited) to convert a stored .docx
 * into HTML, then runs the result through a strict allow-list sanitiser before
 * it reaches the viewer.
 *
 * [SEC] the HTML is document content and is rendered locally only; the
 * sanitiser is defence-in-depth against a crafted .docx (drops scripts, event
 * handlers, and javascript: URLs) even though mammoth emits a safe subset.
 */

/** Tags allowed through to the viewer. Everything else is unwrapped/removed. */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUP', 'SUB',
  'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'DIV',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'IMG',
]);

/** Per-tag allowed attributes (all others are stripped). */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href']),
  IMG: new Set(['src', 'alt']),
  TD: new Set(['colspan', 'rowspan']),
  TH: new Set(['colspan', 'rowspan']),
};

/** URL schemes permitted on href/src (blocks javascript:, etc.). */
const SAFE_URL = /^(https?:|mailto:|data:image\/|#|\/|\.)/i;

/** Removes disallowed nodes/attributes from a parsed DOM subtree in place. */
function scrub(node: Element): void {
  // Iterate over a snapshot — we mutate children as we go.
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED') {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap unknown-but-harmless tags: keep their text/children.
      scrub(child);
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      if (!allowed.has(name)) {
        child.removeAttribute(attr.name);
      } else if ((name === 'href' || name === 'src') && !SAFE_URL.test(attr.value.trim())) {
        child.removeAttribute(attr.name);
      }
    }
    scrub(child);
  }
}

/** Sanitises mammoth's HTML to a safe allow-listed subset (F-43). */
export function sanitizeDocxHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  scrub(doc.body);
  return doc.body.innerHTML;
}

/** Converts stored .docx bytes into sanitised, viewable HTML (F-43). */
export async function convertDocxToHtml(bytes: Uint8Array): Promise<string> {
  const { convertToHtml } = await import('mammoth');
  // Copy into a fresh buffer in this realm so mammoth's unzip is happy. The
  // browser build reads `arrayBuffer`; the Node build (tests) reads `buffer`,
  // so provide both — `Buffer` is absent in the WebView, so that key is skipped.
  const copy = new Uint8Array(bytes);
  const input: { arrayBuffer: ArrayBuffer; buffer?: Uint8Array } = {
    arrayBuffer: copy.buffer,
  };
  if (typeof Buffer !== 'undefined') {
    input.buffer = Buffer.from(copy);
  }
  const result = await convertToHtml(input);
  return sanitizeDocxHtml(result.value);
}
