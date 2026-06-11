/**
 * Input atom (component-library.md §Input).
 * Always label-associated; error via aria-describedby + aria-invalid;
 * data-agent-value reflects the value except for passwords.
 */
import { clsx } from 'clsx';
import { useId, useState, type ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';

/** Props for {@link Input}. */
export interface InputProps extends AgentProps {
  /** HTML input type. */
  type?: 'text' | 'search' | 'password' | 'number' | 'email' | 'tel';
  /** Visible label text (always rendered — never icon-only inputs). */
  label: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Controlled value. */
  value: string;
  /** Error message — rendered below the input and announced. */
  error?: string;
  /** Helper text rendered below the input. */
  helperText?: string;
  /** Disables the input. */
  disabled?: boolean;
  /** Icon before the input text. */
  leadingIcon?: ReactNode;
  /** Icon after the input text (clear, eye toggle, …). */
  trailingIcon?: ReactNode;
  /** Change handler receiving the new value. */
  onChange?: (value: string) => void;
}

/** Labelled text/numeric input with error + helper rows. */
export function Input({
  type = 'text',
  label,
  placeholder,
  value,
  error,
  helperText,
  disabled = false,
  leadingIcon,
  trailingIcon,
  onChange,
  ...agent
}: InputProps): ReactNode {
  const id = useId();
  const [dirty, setDirty] = useState(false);
  const state = error ? 'error' : dirty ? 'dirty' : 'pristine';
  const describedBy = error
    ? `${id}-error`
    : helperText
      ? `${id}-helper`
      : undefined;

  return (
    <div className={clsx('kg-input', disabled && 'kg-input--disabled')}>
      <label className="kg-input__label" htmlFor={id}>
        {label}
      </label>
      <div className={clsx('kg-input__box', error && 'kg-input__box--error')}>
        {leadingIcon && (
          <span className="kg-input__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          id={id}
          className="kg-input__field"
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setDirty(true);
            onChange?.(e.target.value);
          }}
          {...agentAttrs(
            agent,
            state,
            type === 'password' ? undefined : value
          )}
        />
        {trailingIcon && (
          <span className="kg-input__icon" aria-hidden="true">
            {trailingIcon}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="kg-input__error" aria-live="assertive">
          {error}
        </p>
      ) : (
        helperText && (
          <p id={`${id}-helper`} className="kg-input__helper">
            {helperText}
          </p>
        )
      )}
    </div>
  );
}
