import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/**
 * Absolute path of the sql.js WASM. Pinned to the exact sql.js release that
 * jeep-sqlite 2.8.0's bundled glue was compiled against (1.11.0): the glue and
 * the binary must match, and the newer sql.js that jeep-sqlite would resolve
 * (1.14.x) fails to link ("function import requires a callable").
 */
export function resolveSqlWasm(): string {
  return createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm');
}

/**
 * Dev-server only: serves `/assets/sql-wasm.wasm` for the browser demo
 * database. Not part of any build, so nothing is copied into a release.
 */
export function webSqliteWasm(): Plugin {
  return {
    name: 'kagaz-web-sqlite-wasm',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/assets/sql-wasm.wasm', (_req, res) => {
        res.setHeader('Content-Type', 'application/wasm');
        res.end(readFileSync(resolveSqlWasm()));
      });
    },
  };
}
