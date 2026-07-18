/**
 * Centered confirmation/prompt modal (component-library.md; modal rules in
 * interaction-patterns.md §Bottom sheets vs modals vs drawers — "Centered
 * on tablet, full-screen on phone... 0–1 inputs + 2 actions max... primary
 * on the right for affirmative, destructive on the left with Cancel on the
 * right"). Built on a native `<dialog>`, not `IonAlert` — part of the G1-4
 * Ionic-overlay refactor.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { agentAttrs, type AgentProps } from '../agent-props';
import { closeDialog, openDialog, useDialogBackButton } from '../dialog-utils';

/** One button in an {@link Alert}. Callers order these left-to-right —
 * per interaction-patterns.md, put `destructive` first (left) with
 * `cancel` last (right); for an affirmative flow, `cancel` first with the
 * primary action last. */
export interface AlertButton {
  text: string;
  role?: 'cancel' | 'destructive';
  /** Runs on tap, before the dialog closes. Receives the input's current
   * value when the alert has one. */
  handler?: (inputValue?: string) => void;
}

/** Single-field text input, rendered between the message and the buttons. */
export interface AlertInput {
  /** Accessible label (not visibly rendered — the alert's own header/message carries the visible copy). */
  label: string;
  placeholder?: string;
  defaultValue?: string;
}

/** Props for {@link Alert}. */
export interface AlertProps extends AgentProps {
  isOpen: boolean;
  header?: string;
  message?: string;
  /** At most one text input — matches every real usage in this app. */
  input?: AlertInput;
  buttons: AlertButton[];
  onDidDismiss: () => void;
}

/** A centered confirm/prompt dialog — the `IonAlert` replacement. */
export function Alert({
  isOpen,
  header,
  message,
  input,
  buttons,
  onDidDismiss,
  ...agent
}: AlertProps): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [inputValue, setInputValue] = useState(input?.defaultValue ?? '');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      setInputValue(input?.defaultValue ?? '');
      openDialog(dialog);
      // Focus the input (or the dialog itself) once the browser has
      // finished the open transition — matches the native prompt's
      // "ready to type immediately" behavior.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!isOpen && dialog.open) {
      closeDialog(dialog);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed the input only when the dialog transitions open, not on every defaultValue change
  }, [isOpen]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = (): void => onDidDismiss();
    dialog.addEventListener('close', onClose);
    return (): void => dialog.removeEventListener('close', onClose);
  }, [onDidDismiss]);

  useDialogBackButton(isOpen, ref);

  const handleButtonClick = (button: AlertButton): void => {
    button.handler?.(input ? inputValue : undefined);
    if (ref.current) closeDialog(ref.current);
  };

  return (
    <dialog
      ref={ref}
      className="kg-alert"
      onCancel={() => {
        if (ref.current) closeDialog(ref.current);
      }}
      {...agentAttrs(agent, isOpen ? 'expanded' : 'collapsed')}
    >
      <div className="kg-alert__panel">
        {header && <h2 className="kg-alert__header">{header}</h2>}
        {message && <p className="kg-alert__message">{message}</p>}
        {input && (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            className="kg-alert__input"
            aria-label={input.label}
            placeholder={input.placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        )}
        <div className="kg-alert__buttons">
          {buttons.map((button, index) => (
            <button
              key={index}
              type="button"
              className={clsx(
                'kg-alert__btn',
                button.role === 'destructive' && 'kg-alert__btn--destructive',
                button.role === 'cancel' && 'kg-alert__btn--cancel'
              )}
              onClick={() => handleButtonClick(button)}
            >
              {button.text}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
