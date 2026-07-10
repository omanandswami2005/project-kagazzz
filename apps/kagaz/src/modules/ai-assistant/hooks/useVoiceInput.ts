/**
 * Voice-input hook (F-15, 05-ai-assistant-module.md §6.1). Drives hold-to-speak
 * dictation: manages availability, mic permission, the live partial transcript,
 * and delivers the final transcript to `onResult`. Language follows the app
 * locale (hi-IN / en-IN). The transcript never leaves the device.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/core/i18n';
import type { SupportedLanguage } from '@/core/i18n';
import { speechRecognizer } from '../services/speech-recognition.service';

/** Why a dictation attempt could not run. */
export type VoiceError = 'permission' | 'failed';

/** What {@link useVoiceInput} exposes. */
export interface UseVoiceInput {
  /** Whether this device has on-device speech recognition. */
  supported: boolean;
  /** True while actively listening. */
  listening: boolean;
  /** Live partial transcript (for an inline preview). */
  partial: string;
  /** Last error, or null. */
  error: VoiceError | null;
  /** Begins listening (requests mic permission on first use). */
  start: () => Promise<void>;
  /** Stops listening and emits the final transcript. */
  stop: () => Promise<void>;
}

/** Hold-to-speak dictation that feeds `onResult` the final transcript. */
export function useVoiceInput(onResult: (transcript: string) => void): UseVoiceInput {
  const { locale } = useLocale();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  const latest = useRef('');

  useEffect(() => {
    let cancelled = false;
    void speechRecognizer.isAvailable().then((ok) => {
      if (!cancelled) {
        setSupported(ok);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, []);

  // Emits the accumulated transcript exactly once (clears latest so a second
  // call — e.g. native auto-stop racing the button release — is a no-op).
  const finish = useCallback((): void => {
    setListening(false);
    setPartial('');
    const transcript = latest.current.trim();
    latest.current = '';
    if (transcript) {
      onResult(transcript);
    }
  }, [onResult]);

  const start = useCallback(async (): Promise<void> => {
    if (listening) {
      return;
    }
    setError(null);
    const granted = await speechRecognizer.ensurePermission();
    if (!granted) {
      setError('permission');
      return;
    }
    latest.current = '';
    setPartial('');
    const language: SupportedLanguage = locale === 'hi' ? 'hi' : 'en';
    try {
      await speechRecognizer.start(language, {
        onPartial: (text) => {
          latest.current = text;
          setPartial(text);
        },
        onEnd: () => finish(),
      });
      setListening(true);
    } catch {
      setError('failed');
      setListening(false);
    }
  }, [listening, locale, finish]);

  const stop = useCallback(async (): Promise<void> => {
    if (!listening) {
      return;
    }
    await speechRecognizer.stop().catch(() => undefined);
    finish();
  }, [listening, finish]);

  // Safety net: never leave the mic hot if the component unmounts mid-listen.
  useEffect(() => {
    return (): void => {
      void speechRecognizer.stop().catch(() => undefined);
    };
  }, []);

  return { supported, listening, partial, error, start, stop };
}
