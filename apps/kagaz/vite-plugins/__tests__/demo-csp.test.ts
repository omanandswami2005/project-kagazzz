import { describe, expect, it } from 'vitest';
import { allowConnectOrigin, demoCsp } from '../demo-csp';

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

  it('refuses to build for production with the demo URL set, and is a no-op when unset', () => {
    expect(() => demoCsp('http://localhost:11434', 'production')).toThrow('demo-only');
    const plugin = demoCsp(undefined, 'production');
    const transform = plugin.transformIndexHtml as (html: string) => string;
    expect(transform(HTML)).toBe(HTML);
  });
});
