import type { Plugin } from 'vite';

/**
 * Demo-build CSP changes (the shipped policy is strict and offline:
 * `connect-src 'self'`, no WASM). Two independent, opt-in relaxations:
 *  - `connect-src` gets a local Ollama origin when `VITE_OLLAMA_URL` is set;
 *  - `script-src` gets `'wasm-unsafe-eval'` for the browser demo database
 *    (sql.js) when any demo flag is set.
 * The cloud AI proxy is same-origin (`/api/ai/*`), so it needs neither.
 *
 * [SEC] Any demo flag in a `production` build is a hard error — it would weaken
 * the strict offline CSP on a PII app (see ADR-017, ADR-022/023).
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

/** Lets sql.js compile its WASM (browser demo database only). */
export function allowWasm(html: string): string {
  if (!html.includes("script-src 'self'")) {
    throw new Error("index.html CSP no longer contains \"script-src 'self'\"");
  }
  return html.replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'");
}

export interface DemoCspOptions {
  /** `VITE_OLLAMA_URL`, if set. */
  ollamaUrl?: string;
  /** `VITE_CLOUD_AI`, if set. */
  cloudAi?: string;
}

export function demoCsp({ ollamaUrl, cloudAi }: DemoCspOptions, mode: string): Plugin {
  const demo = Boolean(ollamaUrl || cloudAi);
  if (demo && mode === 'production') {
    throw new Error('VITE_OLLAMA_URL / VITE_CLOUD_AI are demo-only and must not be set for a production build');
  }
  return {
    name: 'kagaz-demo-csp',
    transformIndexHtml: (html) => {
      let out = html;
      if (ollamaUrl) {
        out = allowConnectOrigin(out, ollamaUrl);
      }
      return demo ? allowWasm(out) : out;
    },
  };
}
