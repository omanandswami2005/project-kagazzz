import { describe, expect, it } from 'vitest';
import { installPdfjsPolyfills } from '../pdfjs-runtime-polyfills';

describe('Promise.withResolvers polyfill', () => {
  it('installs a working implementation when the native one is absent', async () => {
    const native = Promise.withResolvers;
    // @ts-expect-error simulating an older WebView with no native support
    delete Promise.withResolvers;

    installPdfjsPolyfills();

    expect(typeof Promise.withResolvers).toBe('function');
    const { promise, resolve } = Promise.withResolvers<string>();
    resolve('done');
    await expect(promise).resolves.toBe('done');

    Promise.withResolvers = native;
  });

  it('does not overwrite an existing native implementation', () => {
    const sentinel = (<T>() =>
      ({}) as ReturnType<typeof Promise.withResolvers<T>>) as typeof Promise.withResolvers;
    const native = Promise.withResolvers;
    Promise.withResolvers = sentinel;

    installPdfjsPolyfills();

    expect(Promise.withResolvers).toBe(sentinel);
    Promise.withResolvers = native;
  });
});

describe('Promise.try polyfill', () => {
  it('installs a working implementation when the native one is absent', async () => {
    const native = Promise.try;
    // @ts-expect-error simulating an older WebView with no native support
    delete Promise.try;

    installPdfjsPolyfills();

    expect(typeof Promise.try).toBe('function');
    await expect(Promise.try(() => 'sync value')).resolves.toBe('sync value');
    await expect(
      Promise.try((a: number, b: number) => a + b, 2, 3)
    ).resolves.toBe(5);
    await expect(
      Promise.try(() => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    Promise.try = native;
  });

  it('does not overwrite an existing native implementation', () => {
    const sentinel = (() => Promise.resolve('native')) as typeof Promise.try;
    const native = Promise.try;
    Promise.try = sentinel;

    installPdfjsPolyfills();

    expect(Promise.try).toBe(sentinel);
    Promise.try = native;
  });
});

describe('Uint8Array hex/base64 polyfills', () => {
  it('round-trips bytes through toHex/fromHex when native support is absent', () => {
    const nativeToHex = Uint8Array.prototype.toHex;
    const nativeFromHex = Uint8Array.fromHex;
    // @ts-expect-error simulating an older WebView with no native support
    delete Uint8Array.prototype.toHex;
    // @ts-expect-error simulating an older WebView with no native support
    delete Uint8Array.fromHex;

    installPdfjsPolyfills();

    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(bytes.toHex()).toBe('00010f10ff');
    expect(Uint8Array.fromHex('00010f10ff')).toEqual(bytes);

    Uint8Array.prototype.toHex = nativeToHex;
    Uint8Array.fromHex = nativeFromHex;
  });

  it('round-trips bytes through toBase64/fromBase64 when native support is absent', () => {
    const nativeToBase64 = Uint8Array.prototype.toBase64;
    const nativeFromBase64 = Uint8Array.fromBase64;
    // @ts-expect-error simulating an older WebView with no native support
    delete Uint8Array.prototype.toBase64;
    // @ts-expect-error simulating an older WebView with no native support
    delete Uint8Array.fromBase64;

    installPdfjsPolyfills();

    // `new Uint8Array(...)`, not `new TextEncoder().encode(...)`: jsdom's
    // TextEncoder can return a Uint8Array from a different realm than the
    // one just patched above (its `constructor`/prototype chain differ from
    // the bare `Uint8Array` global) — invisible whenever the *other* realm
    // also has real native toBase64 (true on newer Node locally), but fatal
    // once neither realm does (CI's Node 22 — see the file-level doc
    // comment). Wrapping in a fresh same-realm Uint8Array sidesteps it; a
    // real WebView has only one realm, so this is a test-only concern.
    const bytes = new Uint8Array(new TextEncoder().encode('Kagaz PDF test'));
    const b64 = bytes.toBase64();
    expect(Array.from(Uint8Array.fromBase64(b64))).toEqual(Array.from(bytes));

    Uint8Array.prototype.toBase64 = nativeToBase64;
    Uint8Array.fromBase64 = nativeFromBase64;
  });

  it('does not overwrite existing native implementations', () => {
    const sentinelToHex = (() => 'native-hex') as typeof Uint8Array.prototype.toHex;
    const nativeToHex = Uint8Array.prototype.toHex;
    Uint8Array.prototype.toHex = sentinelToHex;

    installPdfjsPolyfills();

    expect(Uint8Array.prototype.toHex).toBe(sentinelToHex);
    Uint8Array.prototype.toHex = nativeToHex;
  });
});

describe('guardPdfjsWorker', () => {
  class FakeWorker {
    url: string;
    constructor(scriptURL: string | URL) {
      this.url = String(scriptURL);
    }
  }

  it("blocks pdfjs's own worker URL when Promise.withResolvers is missing", () => {
    const nativeWithResolvers = Promise.withResolvers;
    // @ts-expect-error simulating an older WebView with no native support
    delete Promise.withResolvers;
    const nativeWorker = globalThis.Worker;
    globalThis.Worker = FakeWorker as unknown as typeof Worker;

    installPdfjsPolyfills();

    expect(() => new Worker('/assets/mjs/pdf.worker.min.abc123.mjs')).toThrow(
      /pdfjs/i
    );
    expect(
      () => new Worker('/assets/mjs/pdf-manipulation.worker.def456.mjs')
    ).not.toThrow();

    globalThis.Worker = nativeWorker;
    Promise.withResolvers = nativeWithResolvers;
  });

  it('leaves the native Worker untouched when Promise.withResolvers is natively present', () => {
    const nativeWorker = globalThis.Worker;
    globalThis.Worker = FakeWorker as unknown as typeof Worker;

    installPdfjsPolyfills();

    expect(globalThis.Worker).toBe(FakeWorker);

    globalThis.Worker = nativeWorker;
  });
});
