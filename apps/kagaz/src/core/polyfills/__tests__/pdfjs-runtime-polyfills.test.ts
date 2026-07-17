import { describe, expect, it, vi } from 'vitest';

describe('Promise.withResolvers polyfill', () => {
  it('installs a working implementation when the native one is absent', async () => {
    const native = Promise.withResolvers;
    // @ts-expect-error simulating an older WebView with no native support
    delete Promise.withResolvers;

    vi.resetModules();
    await import('../pdfjs-runtime-polyfills');

    expect(typeof Promise.withResolvers).toBe('function');
    const { promise, resolve } = Promise.withResolvers<string>();
    resolve('done');
    await expect(promise).resolves.toBe('done');

    Promise.withResolvers = native;
  });

  it('does not overwrite an existing native implementation', async () => {
    const sentinel = (<T>() =>
      ({}) as ReturnType<typeof Promise.withResolvers<T>>) as typeof Promise.withResolvers;
    const native = Promise.withResolvers;
    Promise.withResolvers = sentinel;

    vi.resetModules();
    await import('../pdfjs-runtime-polyfills');

    expect(Promise.withResolvers).toBe(sentinel);
    Promise.withResolvers = native;
  });
});

describe('Promise.try polyfill', () => {
  it('installs a working implementation when the native one is absent', async () => {
    const native = Promise.try;
    // @ts-expect-error simulating an older WebView with no native support
    delete Promise.try;

    vi.resetModules();
    await import('../pdfjs-runtime-polyfills');

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

  it('does not overwrite an existing native implementation', async () => {
    const sentinel = (() => Promise.resolve('native')) as typeof Promise.try;
    const native = Promise.try;
    Promise.try = sentinel;

    vi.resetModules();
    await import('../pdfjs-runtime-polyfills');

    expect(Promise.try).toBe(sentinel);
    Promise.try = native;
  });
});

describe('Uint8Array hex/base64 polyfills', () => {
  it('round-trips bytes through toHex/fromHex when native support is absent', async () => {
    const nativeToHex = Uint8Array.prototype.toHex;
    const nativeFromHex = Uint8Array.fromHex;
    // @ts-expect-error simulating an older WebView with no native support
    delete Uint8Array.prototype.toHex;
    // @ts-expect-error simulating an older WebView with no native support
    delete Uint8Array.fromHex;

    vi.resetModules();
    await import('../pdfjs-runtime-polyfills');

    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(bytes.toHex()).toBe('00010f10ff');
    expect(Uint8Array.fromHex('00010f10ff')).toEqual(bytes);

    Uint8Array.prototype.toHex = nativeToHex;
    Uint8Array.fromHex = nativeFromHex;
  });

  it('round-trips bytes through toBase64/fromBase64 when native support is absent', async () => {
    const nativeToBase64 = Uint8Array.prototype.toBase64;
    const nativeFromBase64 = Uint8Array.fromBase64;
    // @ts-expect-error simulating an older WebView with no native support
    delete Uint8Array.prototype.toBase64;
    // @ts-expect-error simulating an older WebView with no native support
    delete Uint8Array.fromBase64;

    vi.resetModules();
    await import('../pdfjs-runtime-polyfills');

    const bytes = new TextEncoder().encode('Kagaz PDF test');
    const b64 = bytes.toBase64();
    expect(Array.from(Uint8Array.fromBase64(b64))).toEqual(Array.from(bytes));

    Uint8Array.prototype.toBase64 = nativeToBase64;
    Uint8Array.fromBase64 = nativeFromBase64;
  });

  it('does not overwrite existing native implementations', async () => {
    const sentinelToHex = (() => 'native-hex') as typeof Uint8Array.prototype.toHex;
    const nativeToHex = Uint8Array.prototype.toHex;
    Uint8Array.prototype.toHex = sentinelToHex;

    vi.resetModules();
    await import('../pdfjs-runtime-polyfills');

    expect(Uint8Array.prototype.toHex).toBe(sentinelToHex);
    Uint8Array.prototype.toHex = nativeToHex;
  });
});
