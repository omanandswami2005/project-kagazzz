import type { Plugin } from 'vite';

/**
 * Adds the demo Ollama origin to the CSP `connect-src` directive (the shipped
 * policy is `connect-src 'self'`, which would silently block every call to a
 * local Ollama server). Only runs when `VITE_OLLAMA_URL` is set.
 *
 * [SEC] A production build with the demo URL set is a hard error — it would
 * weaken the strict offline CSP on a PII app (see ADR-017). The value must
 * parse as an http(s) URL; only its origin is used, so it can't smuggle in
 * extra CSP directives.
 */
export function allowConnectOrigin(html: string, ollamaUrl: string): string {
  const url = new URL(ollamaUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`VITE_OLLAMA_URL must be http(s), got "${url.protocol}"`);
  }
  if (!html.includes("connect-src 'self'")) {
    throw new Error("index.html CSP no longer contains \"connect-src 'self'\"");
  }
  return html.replace("connect-src 'self'", `connect-src 'self' ${url.origin}`);
}

export function demoCsp(ollamaUrl: string | undefined, mode: string): Plugin {
  if (ollamaUrl && mode === 'production') {
    throw new Error('VITE_OLLAMA_URL is demo-only and must not be set for a production build');
  }
  return {
    name: 'kagaz-demo-csp',
    transformIndexHtml: (html) => (ollamaUrl ? allowConnectOrigin(html, ollamaUrl) : html),
  };
}
