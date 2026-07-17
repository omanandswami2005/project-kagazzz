/**
 * Polyfills for modern JS APIs pdfjs-dist calls unconditionally, needed on
 * Android System WebView builds older than Chromium 119 (observed: WebView
 * 113, common on devices that haven't picked up a WebView update) — silent in
 * unit tests (jsdom/Node ship all of these natively), only surfacing
 * on-device, where a missing one fails PDF rendering outright.
 *
 * `pdfjs-dist` is pinned to **4.6.82** exactly (see `package.json` and
 * ADR-005 §Version pin in `08-tech-stack-decisions.md`) specifically because
 * it's the newest release that needs only `Promise.withResolvers()` — pdfjs
 * 4.8+ additionally needs `Uint8Array.prototype.toBase64`/`fromBase64`, and
 * 6.x needs those *plus* `Promise.try()` and
 * `Map.prototype.getOrInsertComputed` (a proposal too new for any polyfill to
 * usefully cover yet). `Promise.withResolvers` is the only one of these this
 * app actually exercises today; the rest are kept here, feature-detected and
 * inert, as insurance against a future pdfjs bump reintroducing them.
 *
 * pdfjs's own internal rendering worker turned out not to matter here: on
 * WebView 113 pdfjs falls back to running its worker code inline on the
 * *main thread* ("fake worker" mode) rather than spawning a real Worker, so
 * this main-thread polyfill is what actually fixes rendering. (A real Worker
 * cannot be polyfilled into after the fact from outside — a Worker has its
 * own separate global scope — which is also why `pdf-manipulation.worker.ts`
 * imports this module directly at its own top, for the case where pdfjs
 * *does* use a real worker in some other environment.)
 *
 * Import this for its side effect, once, as early as possible, in every realm
 * that may load pdfjs: the main thread (`main.tsx`) and the PDF manipulation
 * worker (`pdf-manipulation.worker.ts`).
 */

if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function <T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  } {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Promise.try !== 'function') {
  Promise.try = function <T, U extends unknown[]>(
    fn: (...args: U) => T | PromiseLike<T>,
    ...args: U
  ): Promise<Awaited<T>> {
    return new Promise<Awaited<T>>((resolve) =>
      resolve(fn(...args) as Awaited<T> | PromiseLike<Awaited<T>>)
    );
  };
}

const HEX_CHARS = '0123456789abcdef';

if (typeof Uint8Array.prototype.toHex !== 'function') {
  Uint8Array.prototype.toHex = function (this: Uint8Array): string {
    let out = '';
    for (let i = 0; i < this.length; i++) {
      out += HEX_CHARS[this[i] >> 4] + HEX_CHARS[this[i] & 0x0f];
    }
    return out;
  };
}

if (typeof Uint8Array.fromHex !== 'function') {
  Uint8Array.fromHex = function (hex: string): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  };
}

if (typeof Uint8Array.prototype.toBase64 !== 'function') {
  Uint8Array.prototype.toBase64 = function (this: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < this.length; i++) {
      binary += String.fromCharCode(this[i]);
    }
    return btoa(binary);
  };
}

if (typeof Uint8Array.fromBase64 !== 'function') {
  Uint8Array.fromBase64 = function (b64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };
}
