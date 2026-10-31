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

/** How often the native "still listening?" flag is polled (ms). */
const NATIVE_POLL_MS = 400;
/**
 * Grace period for the recognizer's FINAL result. Android fires end-of-speech
 * (and `stopListening()`) first and delivers the final transcript a moment
 * later; detaching listeners before it lands drops the last words.
 */
const FINAL_RESULT_GRACE_MS = 700;
/** Gives up on a session that never produced speech or an end event (ms). */
const START_WATCHDOG_MS = 15_000;

/** Real recognizer backed by @capacitor-community/speech-recognition. */
export class CapacitorSpeechRecognizer implements SpeechRecognizer {
  private poll: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  /** Set while a session is live; resolves the final-result wait early. */
  private onLateResult: (() => void) | null = null;
  private stopping = false;

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
    this.clearTimers();
    this.stopping = false;
    await SpeechRecognition.removeAllListeners();

    let ended = false;
    // The plugin reports nothing when the recognizer dies on its own (no speech,
    // network error, busy) — only a normal end-of-speech. Both routes land here,
    // after the grace period so the final transcript is not cut off.
    const end = (): void => {
      if (ended || this.stopping) {
        return;
      }
      ended = true;
      this.clearTimers();
      setTimeout(handlers.onEnd, FINAL_RESULT_GRACE_MS);
    };

    await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
      const transcript = data.matches[0];
      if (transcript) {
        handlers.onPartial(transcript);
        this.onLateResult?.();
      }
    });
    await SpeechRecognition.addListener('listeningState', (data: { status: string }) => {
      if (data.status === 'started') {
        this.clearWatchdog();
      } else if (data.status === 'stopped') {
        end();
      }
    });
    await SpeechRecognition.start({
      language: STT_LANGUAGE[language],
      maxResults: 1,
      partialResults: true,
      popup: false,
    });

    this.poll = setInterval(() => {
      void SpeechRecognition.isListening().then(
        ({ listening }) => {
          if (!listening) {
            end();
          }
        },
        () => undefined
      );
    }, NATIVE_POLL_MS);
    this.watchdog = setTimeout(end, START_WATCHDOG_MS);
    logger.info({ event: 'assistant.voice.start', language });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.clearTimers();
    // Wait for the final result (resolved early when it arrives), then detach.
    const lateResult = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, FINAL_RESULT_GRACE_MS);
      this.onLateResult = (): void => {
        clearTimeout(timer);
        setTimeout(resolve, 50);
      };
    });
    try {
      await SpeechRecognition.stop();
      await lateResult;
    } catch {
      // Stopping an already-stopped session is fine.
    }
    this.onLateResult = null;
    await SpeechRecognition.removeAllListeners();
    logger.info({ event: 'assistant.voice.stop' });
  }

  private clearWatchdog(): void {
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }

  private clearTimers(): void {
    this.clearWatchdog();
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }
}

/** Shared recognizer instance used by the voice-input hook. */
export const speechRecognizer: SpeechRecognizer = new CapacitorSpeechRecognizer();
