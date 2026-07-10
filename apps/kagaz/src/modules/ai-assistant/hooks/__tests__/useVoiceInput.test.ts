import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceSessionHandlers } from '../../services/speech-recognition.service';
import { useVoiceInput } from '../useVoiceInput';

const stt = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  ensurePermission: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));
const locale = vi.hoisted((): { value: 'en' | 'hi' } => ({ value: 'en' }));

vi.mock('../../services/speech-recognition.service', () => ({ speechRecognizer: stt }));
vi.mock('@/core/i18n', () => ({ useLocale: () => ({ locale: locale.value }) }));

let handlers: VoiceSessionHandlers;

beforeEach(() => {
  vi.clearAllMocks();
  locale.value = 'en';
  stt.isAvailable.mockResolvedValue(true);
  stt.ensurePermission.mockResolvedValue(true);
  stt.stop.mockResolvedValue(undefined);
  stt.start.mockImplementation((_lang: unknown, h: VoiceSessionHandlers) => {
    handlers = h;
    return Promise.resolve();
  });
});

describe('useVoiceInput (F-15)', () => {
  it('reflects device support', async () => {
    stt.isAvailable.mockResolvedValue(false);
    const { result } = renderHook(() => useVoiceInput(vi.fn()));
    await waitFor(() => expect(result.current.supported).toBe(false));
  });

  it('streams partials while listening, emits the final transcript on stop', async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onResult));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.listening).toBe(true);

    act(() => handlers.onPartial('my aadhaar'));
    expect(result.current.partial).toBe('my aadhaar');

    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.listening).toBe(false);
    expect(result.current.partial).toBe('');
    expect(onResult).toHaveBeenCalledExactlyOnceWith('my aadhaar');
  });

  it('passes the Hindi locale through to the recognizer', async () => {
    locale.value = 'hi';
    const { result } = renderHook(() => useVoiceInput(vi.fn()));
    await act(async () => {
      await result.current.start();
    });
    expect(stt.start).toHaveBeenCalledWith('hi', expect.anything());
  });

  it('sets a permission error and does not listen when mic is denied', async () => {
    stt.ensurePermission.mockResolvedValue(false);
    const onResult = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onResult));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.error).toBe('permission');
    expect(result.current.listening).toBe(false);
    expect(stt.start).not.toHaveBeenCalled();
  });

  it('emits the transcript once when native auto-stop races the release', async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onResult));

    await act(async () => {
      await result.current.start();
    });
    act(() => handlers.onPartial('search term'));
    // Native silence-timeout fires, then the user releases the button.
    act(() => handlers.onEnd());
    await act(async () => {
      await result.current.stop();
    });
    expect(onResult).toHaveBeenCalledExactlyOnceWith('search term');
  });

  it('surfaces a failure when the recognizer cannot start', async () => {
    stt.start.mockRejectedValue(new Error('busy'));
    const { result } = renderHook(() => useVoiceInput(vi.fn()));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.error).toBe('failed');
    expect(result.current.listening).toBe(false);
  });
});
