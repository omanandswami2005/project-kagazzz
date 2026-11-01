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
export type VoiceError = 'permission' | 'failed' | 'no_speech';

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
  /** A session is starting or live (state `listening` lags a render behind). */
  const active = useRef(false);
  /** The recognizer is actually running (start() resolved). */
  const heardSession = useRef(false);
  /** stop() arrived before start() finished. */
  const stopRequested = useRef(false);

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
    active.current = false;
    const transcript = latest.current.trim();
    latest.current = '';
    if (transcript) {
      onResult(transcript);
    } else if (heardSession.current) {
      // The recognizer ran but produced nothing (silence / no match / its own error).
      setError('no_speech');
    }
    heardSession.current = false;
  }, [onResult]);

  const start = useCallback(async (): Promise<void> => {
    if (active.current) {
      return;
    }
    active.current = true;
    stopRequested.current = false;
    setError(null);
    const granted = await speechRecognizer.ensurePermission();
    if (!granted) {
      active.current = false;
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
      heardSession.current = true;
      setListening(true);
    } catch {
      active.current = false;
      setError('failed');
      setListening(false);
      return;
    }
    // The user let go while the permission prompt / recognizer start was still
    // in flight: honour it now instead of leaving the mic hot.
    if (stopRequested.current) {
      await speechRecognizer.stop().catch(() => undefined);
      finish();
    }
  }, [locale, finish]);

  const stop = useCallback(async (): Promise<void> => {
    if (!active.current) {
      return;
    }
    if (!heardSession.current) {
      stopRequested.current = true; // start() is still in flight
      return;
    }
    await speechRecognizer.stop().catch(() => undefined);
    finish();
  }, [finish]);

  // Safety net: never leave the mic hot if the component unmounts mid-listen.
  useEffect(() => {
    return (): void => {
      void speechRecognizer.stop().catch(() => undefined);
    };
  }, []);

  return { supported, listening, partial, error, start, stop };
}
