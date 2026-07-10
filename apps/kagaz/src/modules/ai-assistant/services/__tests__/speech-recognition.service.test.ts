import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners: Record<string, (data: unknown) => void> = {};
const plugin = vi.hoisted(() => ({
  available: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  removeAllListeners: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn(),
}));

vi.mock('@capacitor-community/speech-recognition', () => ({ SpeechRecognition: plugin }));

import { CapacitorSpeechRecognizer } from '../speech-recognition.service';

const stt = new CapacitorSpeechRecognizer();

beforeEach(() => {
  for (const k of Object.keys(listeners)) delete listeners[k];
  vi.clearAllMocks();
  plugin.addListener.mockImplementation((event: string, cb: (d: unknown) => void) => {
    listeners[event] = cb;
    return Promise.resolve({ remove: vi.fn() });
  });
  plugin.start.mockResolvedValue(undefined);
  plugin.stop.mockResolvedValue(undefined);
  plugin.removeAllListeners.mockResolvedValue(undefined);
});

describe('CapacitorSpeechRecognizer (F-15)', () => {
  it('reports availability, defaulting to false on error', async () => {
    plugin.available.mockResolvedValueOnce({ available: true });
    expect(await stt.isAvailable()).toBe(true);
    plugin.available.mockResolvedValueOnce({ available: false });
    expect(await stt.isAvailable()).toBe(false);
    plugin.available.mockRejectedValueOnce(new Error('no plugin'));
    expect(await stt.isAvailable()).toBe(false);
  });

  it('grants permission when already granted without prompting', async () => {
    plugin.checkPermissions.mockResolvedValue({ speechRecognition: 'granted' });
    expect(await stt.ensurePermission()).toBe(true);
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
  });

  it('requests permission when not yet granted', async () => {
    plugin.checkPermissions.mockResolvedValue({ speechRecognition: 'prompt' });
    plugin.requestPermissions.mockResolvedValue({ speechRecognition: 'granted' });
    expect(await stt.ensurePermission()).toBe(true);
    expect(plugin.requestPermissions).toHaveBeenCalled();
  });

  it('returns false when permission is denied or the check throws', async () => {
    plugin.checkPermissions.mockResolvedValue({ speechRecognition: 'prompt' });
    plugin.requestPermissions.mockResolvedValue({ speechRecognition: 'denied' });
    expect(await stt.ensurePermission()).toBe(false);
    plugin.checkPermissions.mockRejectedValueOnce(new Error('boom'));
    expect(await stt.ensurePermission()).toBe(false);
  });

  it('maps the app locale to a BCP-47 tag and streams partials', async () => {
    const onPartial = vi.fn();
    const onEnd = vi.fn();
    await stt.start('hi', { onPartial, onEnd });

    expect(plugin.start).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'hi-IN', partialResults: true, popup: false })
    );
    // Simulate the native partial + auto-stop events.
    listeners.partialResults?.({ matches: ['मेरा आधार'] });
    listeners.partialResults?.({ matches: [''] }); // empty ignored
    listeners.listeningState?.({ status: 'stopped' });

    expect(onPartial).toHaveBeenCalledExactlyOnceWith('मेरा आधार');
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('uses en-IN for English', async () => {
    await stt.start('en', { onPartial: vi.fn(), onEnd: vi.fn() });
    expect(plugin.start).toHaveBeenCalledWith(expect.objectContaining({ language: 'en-IN' }));
  });

  it('stop() swallows a stop error and still detaches listeners', async () => {
    plugin.stop.mockRejectedValueOnce(new Error('not listening'));
    await expect(stt.stop()).resolves.toBeUndefined();
    expect(plugin.removeAllListeners).toHaveBeenCalled();
  });
});
