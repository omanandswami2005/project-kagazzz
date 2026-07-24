/**
 * Hold-to-speak mic button (F-15). Dictates into a text target via native
 * on-device STT ({@link useVoiceInput}). Renders nothing when the device has no
 * speech recognition, so callers can drop it in unconditionally.
 *
 * Interaction: press-and-hold to speak (pointer), release to commit — plus a
 * keyboard toggle (Enter/Space) so it's operable without a pointer `[A11Y]`.
 * Partial transcripts stream to `onPartial` for a live preview; the final
 * transcript goes to `onResult`. While listening, a big
 * {@link VoiceListeningModal} layers over the small inline pulse below —
 * see that component for the visualization's honesty note.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { VoiceListeningModal } from './VoiceListeningModal';
import './voice-input.css';

/** Props for {@link MicButton}. */
export interface MicButtonProps {
  /** Receives the final transcript when listening stops. */
  onResult: (transcript: string) => void;
  /** Receives each partial transcript while listening (optional live preview). */
  onPartial?: (transcript: string) => void;
}

/** Microphone control for hold-to-speak dictation. */
export function MicButton({ onResult, onPartial }: MicButtonProps): ReactNode {
  const { t } = useTranslation('documents');
  const voice = useVoiceInput(onResult);
  const held = useRef(false);

  useEffect(() => {
    if (voice.listening && voice.partial) {
      onPartial?.(voice.partial);
    }
  }, [voice.partial, voice.listening, onPartial]);

  if (!voice.supported) {
    return null;
  }

  const stopListening = (): void => {
    held.current = false;
    void voice.stop();
  };

  const release = (): void => {
    if (held.current) {
      stopListening();
    }
  };

  const label =
    voice.error === 'permission'
      ? t('search.voice.permission_denied')
      : voice.listening
        ? t('search.voice.stop')
        : t('search.voice.start');

  return (
    <>
      <button
        type="button"
        className={`kg-btn kg-btn--icon-only kg-btn--sm kg-mic${voice.listening ? ' kg-mic--on' : ''}`}
        aria-label={label}
        aria-pressed={voice.listening}
        data-agent-id="vault.home.voice-search"
        data-agent-state={voice.listening ? 'listening' : voice.error ? 'error' : 'idle'}
        onPointerDown={(e) => {
          e.preventDefault();
          held.current = true;
          // Bug-audit fix: without capture, ordinary finger drift during a
          // multi-second hold moves the pointer outside the button's small
          // (icon-only) bounds and fires pointerleave, silently cutting
          // dictation short — same reasoning DocumentListItem's long-press
          // capture already documents for this codebase's touchscreens.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Best-effort only — release/stop still work without capture.
          }
          void voice.start();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        // Keyboard activation (detail === 0) toggles; pointer clicks are already
        // handled by the press/release pair above.
        onClick={(e) => {
          if (e.detail === 0) {
            void (voice.listening ? voice.stop() : voice.start());
          }
        }}
      >
        <Icon name="Mic" size={20} aria-hidden />
      </button>
      {voice.error === 'permission' && (
        <span role="alert" className="kg-mic__hint">
          {t('search.voice.permission_denied')}
        </span>
      )}
      <VoiceListeningModal
        isOpen={voice.listening}
        partial={voice.partial}
        onCancel={stopListening}
      />
    </>
  );
}
