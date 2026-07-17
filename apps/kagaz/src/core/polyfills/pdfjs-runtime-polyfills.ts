/**
 * Polyfills for modern JS APIs pdfjs-dist calls unconditionally, needed on
 * Android System WebView builds older than Chromium 119 (observed: WebView
 * 113, common on devices that haven't picked up a WebView update) — silent in
 * unit tests (jsdom/Node ship all of these natively), only surfacing
 * on-device, where a missing one fails PDF rendering/text-extraction outright.
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
 * pdfjs's own internal worker (`pdf.worker.min.mjs`) is a *separate JS realm*
 * this main-thread polyfill cannot reach — a Worker only inherits the global
 * scope the browser gives it, not whatever the page that spawned it patched.
 * pdfjs tries a real `new Worker(...)` first and only falls back to running
 * its worker code inline on the main thread ("fake worker" mode) if that
 * fails. Its fallback path has two triggers: a synchronous `catch` around the
 * `new Worker()` call (reliable), and an async `worker.addEventListener(
 * 'error', ...)` for failures *after* construction succeeds (unreliable on
 * this WebView: a module worker whose top-level code throws — exactly what
 * happens when its own copy of `Promise.withResolvers` is missing — does not
 * reliably fire that `error` event here, so pdfjs's "test" handshake message
 * is never answered and the caller hangs forever, e.g. an upload stuck at
 * 90%/"Finalizing"). See `guardPdfjsWorker` below, which forces the *reliable*
 * synchronous path instead of depending on the async one.
 *
 * Import this for its side effect, once, as early as possible, in every realm
 * that may load pdfjs: the main thread (`main.tsx`) and the PDF manipulation
 * worker (`pdf-manipulation.worker.ts`).
 */

// Captured before the polyfill below installs itself: true only on the exact
// old-engine case this file exists for. A Worker spawned by this same JS
// engine is missing the same natively-unsupported APIs in its own realm, so
// this main-thread reading doubles as a reliable proxy for "pdfjs's real
// worker will crash on load" — see `guardPdfjsWorker` at the bottom.
const nativeWithResolversMissing = typeof Promise.withResolvers !== 'function';

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

/**
 * Forces pdfjs's own internal worker to fail synchronously on construction —
 * see the top-of-file doc comment for why the async `error`-event fallback
 * this relies on by default is not reliable on this WebView. Scoped to
 * pdfjs's worker chunk by URL only (`pdf.worker` in the path); every other
 * `new Worker(...)` in the app — including this app's own
 * `pdf-manipulation.worker.ts` — passes through untouched, and this whole
 * function is a no-op wherever `Promise.withResolvers` is natively present
 * (i.e. never runs on a modern WebView, or in tests). An earlier attempt
 * patched *all* Worker construction to inject this polyfill by wrapping the
 * target script in a blob+import shim; that broke unrelated workers whose
 * relative imports didn't resolve inside the wrapper and was reverted. This
 * version never touches how a worker's script loads — it only ever refuses
 * to construct the one specific worker already known to crash on load.
 */
function guardPdfjsWorker(): void {
  if (!nativeWithResolversMissing || typeof Worker === 'undefined') return;
  const NativeWorker = Worker;
  class PdfjsWorkerGuard extends NativeWorker {
    constructor(scriptURL: string | URL, options?: WorkerOptions) {
      const url = typeof scriptURL === 'string' ? scriptURL : scriptURL.href;
      if (/pdf\.worker/i.test(url)) {
        throw new DOMException(
          "pdfjs's real worker is disabled on this engine (missing " +
            'Promise.withResolvers in Worker realms); falls back to fake-worker mode.',
          'NotSupportedError'
        );
      }
      super(scriptURL, options);
    }
  }
  globalThis.Worker = PdfjsWorkerGuard;
}

guardPdfjsWorker();
