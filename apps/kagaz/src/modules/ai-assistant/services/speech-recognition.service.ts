/**
 * Speech-to-text gate (05-ai-assistant-module.md §6.1). Wraps the native
 * on-device speech recognizer behind a protocol so hooks/components and tests
 * never touch the plugin directly.
 *
 * Runs 100% on-device (offline native STT) — no audio or transcript ever leaves
 * the phone, consistent with the V1 no-network guarantee. In partial-results
 * mode the plugin streams the running transcript and emits no separate "final"
 * event, so the last partial before `stop()` is the result.
 */
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { log } from '@/core/logging';
import type { SupportedLanguage } from '@/core/i18n';

const logger = log('ai-assistant');

/** Maps an app locale to the recognizer's BCP-47 tag (§6.1: hi-IN / en-IN). */
const STT_LANGUAGE = {
  en: 'en-IN',
  hi: 'hi-IN',
} as const satisfies Record<SupportedLanguage, string>;

/** Callbacks a listening session streams back. */
export interface VoiceSessionHandlers {
  /** Fired for each partial transcript while listening. */
  onPartial: (transcript: string) => void;
  /** Fired when the recognizer stops on its own (silence/timeout). */
  onEnd: () => void;
}

/** The speech-to-text capability voice input depends on. */
export interface SpeechRecognizer {
  /** Whether on-device speech recognition exists on this device. */
  isAvailable(): Promise<boolean>;
  /** Checks and, if needed, requests mic permission; true when granted. */
  ensurePermission(): Promise<boolean>;
  /** Starts listening in the given app language; never throws. */
  start(language: SupportedLanguage, handlers: VoiceSessionHandlers): Promise<void>;
  /** Stops listening and detaches listeners; never throws. */
  stop(): Promise<void>;
}

/** Real recognizer backed by @capacitor-community/speech-recognition. */
export class CapacitorSpeechRecognizer implements SpeechRecognizer {
  async isAvailable(): Promise<boolean> {
    try {
      const { available } = await SpeechRecognition.available();
      return available;
    } catch {
      return false;
    }
  }

  async ensurePermission(): Promise<boolean> {
    try {
      const current = await SpeechRecognition.checkPermissions();
      if (current.speechRecognition === 'granted') {
        return true;
      }
      const requested = await SpeechRecognition.requestPermissions();
      return requested.speechRecognition === 'granted';
    } catch {
      return false;
    }
  }

  async start(language: SupportedLanguage, handlers: VoiceSessionHandlers): Promise<void> {
    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
      const transcript = data.matches[0];
      if (transcript) {
        handlers.onPartial(transcript);
      }
    });
    await SpeechRecognition.addListener('listeningState', (data: { status: string }) => {
      if (data.status === 'stopped') {
        handlers.onEnd();
      }
    });
    await SpeechRecognition.start({
      language: STT_LANGUAGE[language],
      maxResults: 1,
      partialResults: true,
      popup: false,
    });
    logger.info({ event: 'assistant.voice.start', language });
  }

  async stop(): Promise<void> {
    try {
      await SpeechRecognition.stop();
    } catch {
      // Stopping an already-stopped session is fine.
    }
    await SpeechRecognition.removeAllListeners();
    logger.info({ event: 'assistant.voice.stop' });
  }
}

/** Shared recognizer instance used by the voice-input hook. */
export const speechRecognizer: SpeechRecognizer = new CapacitorSpeechRecognizer();
