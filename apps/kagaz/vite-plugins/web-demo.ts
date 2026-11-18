import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/**
 * Browser web demo — TESTING ONLY, never part of a store build.
 *
 * `pnpm --filter kagaz dev:web-demo` (= `VITE_WEB_DEMO=1 vite`) runs the app in a
 * desktop browser on an unencrypted, in-browser sql.js database (jeep-sqlite) so the
 * vault UI can be exercised without a phone. On-device AI is Android-only, so the
 * AI screens show "not available on this platform" here.
 *
 * Every piece is dev-server only (`apply: 'serve'`): `vite build` never runs these
 * plugins, so the release `index.html` CSP and bundle are untouched, and
 * `__KAGAZ_DEMO__` (vite.config.ts) is the constant `false` in every build.
 */

/** True only for the dev server with the web-demo flag set. */
export function isWebDemoServe(command: 'serve' | 'build', flag: string | undefined): boolean {
  if (command === 'build' && flag) {
    // [SEC] The demo store is unencrypted and needs a weaker CSP — refuse loudly.
    throw new Error('VITE_WEB_DEMO is a dev-server-only testing flag and must not be set for a build');
  }
  return command === 'serve' && flag === '1';
}

/**
 * Absolute path of the sql.js WASM. Pinned to the exact sql.js release that
 * jeep-sqlite 2.8.0's bundled glue was compiled against (1.11.0): the glue and
 * the binary must match, and the newer sql.js that jeep-sqlite would resolve
 * (1.14.x) fails to link ("function import requires a callable").
 */
export function resolveSqlWasm(): string {
  return createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm');
}

/** Lets sql.js compile its WASM — applied to the dev server's HTML only. */
export function allowWasm(html: string): string {
  if (!html.includes("script-src 'self'")) {
    throw new Error("index.html CSP no longer contains \"script-src 'self'\"");
  }
  return html.replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'");
}

/** Dev-server plugin: serves `/assets/sql-wasm.wasm` and relaxes the dev page's CSP for it. */
export function webDemo(): Plugin {
  return {
    name: 'kagaz-web-demo',
    apply: 'serve',
    transformIndexHtml: (html) => allowWasm(html),
    configureServer(server): void {
      server.middlewares.use('/assets/sql-wasm.wasm', (_req, res) => {
        res.setHeader('Content-Type', 'application/wasm');
        res.end(readFileSync(resolveSqlWasm()));
      });
    },
  };
}
