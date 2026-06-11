/**
 * Toggle atom (component-library.md §Toggle).
 * role="switch" + aria-checked; label visible or via aria-label.
 */
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';

/** Props for {@link Toggle}. */
export interface ToggleProps extends AgentProps {
  /** Toggle state. */
  enabled?: boolean;
  /** Describes what is being toggled (visible label). */
  label: string;
  /** Disables the toggle. */
  disabled?: boolean;
  /** Change handler. */
  onChange?: (enabled: boolean) => void;
}

/** Binary on/off switch for settings. */
export function Toggle({
  enabled = false,
  label,
  disabled = false,
  onChange,
  ...agent
}: ToggleProps): ReactNode {
  // 'selected' = on, 'idle' = off (fixed vocabulary); the boolean rides
  // on data-agent-value.
  const state = disabled ? 'disabled' : enabled ? 'selected' : 'idle';
  return (
    <label className={clsx('kg-toggle', disabled && 'kg-toggle--disabled')}>
      <span className="kg-toggle__label">{label}</span>
      <button
        type="button"
        role="switch"
        className={clsx('kg-toggle__track', enabled && 'kg-toggle__track--on')}
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange?.(!enabled)}
        {...agentAttrs(agent, state, String(enabled))}
      >
        <span className="kg-toggle__thumb" aria-hidden="true" />
      </button>
    </label>
  );
}
