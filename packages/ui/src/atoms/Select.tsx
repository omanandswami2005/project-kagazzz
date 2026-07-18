/**
 * Select atom (component-library.md — no dedicated Select spec existed;
 * follows the same conventions as Button/Input). A native `<select>`
 * overlaid on a styled trigger: full native keyboard/a11y semantics, and
 * the options list is drawn by the OS shell, not app CSS — the class of
 * viewport-overflow bug Ionic's `IonSelect` popover interface has (see
 * DEVELOPMENT-CHECKLIST.md G1-4) cannot occur here structurally, not just
 * by coincidence of screen size.
 */
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';
import { Icon } from './Icon';

/** One choice in a {@link Select}. */
export interface SelectOption {
  value: string;
  label: string;
}

/** Props for {@link Select}. */
export interface SelectProps extends AgentProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Accessible name (required — the trigger shows only the value). */
  'aria-label': string;
}

/** Native-backed select with a design-system-styled trigger. */
export function Select({
  value,
  options,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  ...agent
}: SelectProps): ReactNode {
  const selected = options.find((o) => o.value === value);
  return (
    <span
      className={clsx('kg-select', disabled && 'kg-select--disabled')}
      {...agentAttrs(agent, disabled ? 'disabled' : 'idle', value)}
    >
      <span className="kg-select__value">{selected?.label ?? value}</span>
      <Icon name="ChevronDown" size={16} />
      <select
        className="kg-select__native"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}
