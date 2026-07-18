import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '../index';

describe('copyToClipboard (F-68)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns false for empty text without touching the clipboard', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyToClipboard('')).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('writes via the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyToClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the async API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const exec = vi.fn().mockReturnValue(true);
    // jsdom has no execCommand by default.
    (document as unknown as { execCommand: unknown }).execCommand = exec;

    expect(await copyToClipboard('fallback text')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    // The temporary textarea must be cleaned up.
    expect(document.querySelector('textarea')).toBeNull();

    delete (document as unknown as { execCommand?: unknown }).execCommand;
  });

  it('returns false when neither path is available', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyToClipboard('nowhere')).toBe(false);
  });
});

describe('copyToClipboard autoClearMs (F-84)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clears the clipboard after the requested delay', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await copyToClipboard('secret-value', { autoClearMs: 30_000 });
    expect(writeText).toHaveBeenCalledWith('secret-value');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(writeText).toHaveBeenLastCalledWith('');
  });

  it('a newer copy cancels a pending clear from an older one', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await copyToClipboard('first', { autoClearMs: 30_000 });
    await vi.advanceTimersByTimeAsync(10_000);
    await copyToClipboard('second', { autoClearMs: 30_000 });

    // The first timer would have fired at 30s from its own start (t=30s);
    // advance past that point without the second's own clear (t=40s) firing yet.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(writeText).not.toHaveBeenLastCalledWith('');

    await vi.advanceTimersByTimeAsync(10_000);
    expect(writeText).toHaveBeenLastCalledWith('');
  });

  it('does not schedule a clear when autoClearMs is omitted', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await copyToClipboard('no-clear');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('no-clear');
  });
});
