import { describe, expect, it } from 'vitest';
import { allowConnectOrigin, allowWasm, demoCsp } from '../demo-csp';
import { resolveSqlWasm } from '../web-sqlite-wasm';

const HTML = `<meta content="default-src 'self'; connect-src 'self'; script-src 'self'">`;

describe('demo CSP plugin', () => {
  it('adds only the origin of the Ollama URL to connect-src', () => {
    const out = allowConnectOrigin(HTML, 'http://localhost:11434/some/path?x=1');
    expect(out).toContain("connect-src 'self' http://localhost:11434;");
    expect(out).toContain("script-src 'self'");
  });

  it('rejects non-http(s) URLs and a CSP it cannot patch', () => {
    expect(() => allowConnectOrigin(HTML, 'file:///etc/passwd')).toThrow('http(s)');
    expect(() => allowConnectOrigin('<html></html>', 'http://localhost:11434')).toThrow('connect-src');
  });

  it('adds wasm-unsafe-eval to script-src only, and rejects a CSP it cannot patch', () => {
    expect(allowWasm(HTML)).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(() => allowWasm('<html></html>')).toThrow('script-src');
  });

  it('cloud-only demo adds WASM but no extra connect origin', () => {
    const transform = demoCsp({ cloudAi: '1' }, 'development').transformIndexHtml as (html: string) => string;
    const out = transform(HTML);
    expect(out).toContain("connect-src 'self';");
    expect(out).toContain("'wasm-unsafe-eval'");
  });

  it('resolves the sql.js WASM that the dev server serves', () => {
    expect(resolveSqlWasm()).toMatch(/sql-wasm\.wasm$/);
  });

  it('refuses to build for production with any demo flag set, and is a no-op when unset', () => {
    expect(() => demoCsp({ ollamaUrl: 'http://localhost:11434' }, 'production')).toThrow('demo-only');
    expect(() => demoCsp({ cloudAi: '1' }, 'production')).toThrow('demo-only');
    const plugin = demoCsp({}, 'production');
    const transform = plugin.transformIndexHtml as (html: string) => string;
    expect(transform(HTML)).toBe(HTML);
  });
});
