/**
 * Checkbox atom (component-library.md §Checkbox).
 * Label is always visible; indeterminate exposes aria-checked="mixed".
 */
import { clsx } from 'clsx';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';

/** Props for {@link Checkbox}. */
export interface CheckboxProps extends AgentProps {
  /** Checked state. */
  checked?: boolean;
  /** Partially checked (parent of mixed children). */
  indeterminate?: boolean;
  /** Visible label — never render a checkbox without one. */
  label: string;
  /** Disables the checkbox. */
  disabled?: boolean;
  /** Change handler. */
  onChange?: (checked: boolean) => void;
}

/** Multi-select option with a 48px touch target. */
export function Checkbox({
  checked = false,
  indeterminate = false,
  label,
  disabled = false,
  onChange,
  ...agent
}: CheckboxProps): ReactNode {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const state = disabled
    ? 'disabled'
    : indeterminate
      ? 'indeterminate'
      : checked
        ? 'checked'
        : 'unchecked';

  return (
    <div className={clsx('kg-checkbox', disabled && 'kg-checkbox--disabled')}>
      <input
        ref={ref}
        id={id}
        className="kg-checkbox__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : checked}
        onChange={(e) => onChange?.(e.target.checked)}
        {...agentAttrs(agent, state, String(checked))}
      />
      <label className="kg-checkbox__label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}
