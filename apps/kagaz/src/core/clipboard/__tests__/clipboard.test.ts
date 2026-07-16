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
