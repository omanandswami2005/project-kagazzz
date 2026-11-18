import { describe, expect, it } from 'vitest';
import { allowWasm, isWebDemoServe, resolveSqlWasm, webDemo } from '../web-demo';

const HTML = `<meta content="default-src 'self'; connect-src 'self'; script-src 'self'">`;

describe('web demo (dev server only)', () => {
  it('is on only for the dev server with VITE_WEB_DEMO=1', () => {
    expect(isWebDemoServe('serve', '1')).toBe(true);
    expect(isWebDemoServe('serve', undefined)).toBe(false);
    expect(isWebDemoServe('build', undefined)).toBe(false);
  });

  it('refuses any build with the demo flag set', () => {
    expect(() => isWebDemoServe('build', '1')).toThrow('dev-server-only');
  });

  it('never runs during a build', () => {
    expect(webDemo().apply).toBe('serve');
  });

  it('adds wasm-unsafe-eval to script-src only, and rejects a CSP it cannot patch', () => {
    const out = allowWasm(HTML);
    expect(out).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(out).toContain("connect-src 'self';");
    expect(() => allowWasm('<html></html>')).toThrow('script-src');
  });

  it('resolves the sql.js WASM that the dev server serves', () => {
    expect(resolveSqlWasm()).toMatch(/sql-wasm\.wasm$/);
  });
});
