/**
 * The chat's message box: a multi-line field that grows with the text (up to
 * about six lines), sends on Enter and inserts a newline on Shift+Enter. Enter
 * is ignored while an IME composition is open, so typing Hindi/Hinglish with a
 * keyboard that confirms characters with Enter never sends half a word.
 */
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

const MAX_HEIGHT_PX = 144;

export interface ChatTextareaProps {
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter (without Shift). */
  onSubmit: () => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatTextarea({ value, onChange, onSubmit, label, placeholder, disabled }: ChatTextareaProps): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow to fit the content, then scroll inside the box once it is tall enough.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <textarea
      ref={ref}
      className="kg-chat__textarea"
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      data-agent-id="ai.chat.input"
    />
  );
}
