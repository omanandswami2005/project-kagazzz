/**
 * Radio atom (component-library.md §Radio).
 * Wrap groups in role="radiogroup" with aria-labelledby at the call site.
 */
import { clsx } from 'clsx';
import { useId, type ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';

/** Props for {@link Radio}. */
export interface RadioProps extends AgentProps {
  /** Radio value submitted with the group. */
  value: string;
  /** Visible label. */
  label: string;
  /** Selected state. */
  checked?: boolean;
  /** Disables the radio. */
  disabled?: boolean;
  /** Radio group name. */
  name: string;
  /** Change handler — fires with the radio's value when selected. */
  onChange?: (value: string) => void;
}

/** Single-select option within a named radio group. */
export function Radio({
  value,
  label,
  checked = false,
  disabled = false,
  name,
  onChange,
  ...agent
}: RadioProps): ReactNode {
  const id = useId();
  const state = disabled ? 'disabled' : checked ? 'checked' : 'unchecked';
  return (
    <div className={clsx('kg-radio', disabled && 'kg-radio--disabled')}>
      <input
        id={id}
        className="kg-radio__input"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(value)}
        {...agentAttrs(agent, state, value)}
      />
      <label className="kg-radio__label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}
