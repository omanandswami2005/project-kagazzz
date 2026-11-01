/**
 * Big, centered "I'm listening" modal shown while {@link useVoiceInput}'s
 * `listening` is true (F-15 device-testing follow-up). Layers over
 * MicButton's existing small inline pulse — the button becomes visually
 * covered once this opens, so the modal carries its own explicit stop
 * control (a pointer-hold release on the covered button won't reliably
 * land back on it once this dialog is the topmost hit-test target).
 *
 * Built the same way as `Alert`/`ActionSheet` (@kagaz/ui): a native
 * `<dialog>` via the shared `openDialog`/`closeDialog`/`useDialogBackButton`
 * helpers — no bespoke open/close/hardware-back logic here.
 *
 * HONESTY NOTE — this is NOT a real audio/frequency visualization. The
 * on-device recognizer this app uses (`@capacitor-community/speech-recognition`,
 * see `../services/speech-recognition.service.ts`) exposes only transcript
 * text + a started/stopped listening state — no amplitude, volume, or
 * frequency data (confirmed against the plugin's real TypeScript
 * definitions, `SpeechRecognitionPlugin`). Standing up a second live mic
 * tap via `getUserMedia` + `AnalyserNode` to derive real levels would
 * contend with the native recognizer for exclusive mic access on Android
 * and has no guaranteed WebView support in this app's Capacitor shell, so
 * per this app's "never fabricate a capability" principle, the orb below
 * is a **canned CSS keyframe pulse** — a plausible "listening" effect, not
 * real audio analysis. Do not read the ring motion as reacting to voice.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, closeDialog, openDialog, useDialogBackButton } from '@kagaz/ui';
import './voice-listening-modal.css';

/** Props for {@link VoiceListeningModal}. */
export interface VoiceListeningModalProps {
  /** Whether the mic is actively listening (mirrors `useVoiceInput().listening`). */
  isOpen: boolean;
  /** Live partial transcript, shown under the orb as it streams in. */
  partial: string;
  /** Fires when the modal closes however it closed (stop tap, scrim, Esc, hardware back) — callers stop the mic here. */
  onCancel: () => void;
}

/** Full-screen listening feedback for hold-to-speak dictation (F-15). */
export function VoiceListeningModal({
  isOpen,
  partial,
  onCancel,
}: VoiceListeningModalProps): ReactNode {
  const { t } = useTranslation('ai-assistant');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      openDialog(dialog);
    } else if (!isOpen && dialog.open) {
      closeDialog(dialog);
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = (): void => onCancel();
    dialog.addEventListener('close', onClose);
    return (): void => dialog.removeEventListener('close', onClose);
  }, [onCancel]);

  useDialogBackButton(isOpen, ref);

  return (
    <dialog
      ref={ref}
      className="kg-voice-modal"
      onCancel={() => {
        if (ref.current) closeDialog(ref.current);
      }}
      data-agent-id="ai-assistant.voice-modal"
      data-agent-state={isOpen ? 'expanded' : 'collapsed'}
    >
      <div className="kg-voice-modal__panel">
        <div className="kg-voice-modal__orb" aria-hidden="true">
          <span className="kg-voice-modal__ring kg-voice-modal__ring--1" />
          <span className="kg-voice-modal__ring kg-voice-modal__ring--2" />
          <span className="kg-voice-modal__ring kg-voice-modal__ring--3" />
          <span className="kg-voice-modal__core" />
        </div>
        <p className="kg-voice-modal__status">{t('listening')}</p>
        <p className="kg-voice-modal__transcript" aria-live="polite">
          {partial || t('voice_modal.hint')}
        </p>
        <button
          type="button"
          className="kg-voice-modal__stop"
          data-agent-id="ai-assistant.voice-modal.stop"
          aria-label={t('voice_modal.stop')}
          onClick={() => {
            if (ref.current) closeDialog(ref.current);
          }}
        >
          <Icon name="X" size={24} aria-hidden />
        </button>
      </div>
    </dialog>
  );
}
