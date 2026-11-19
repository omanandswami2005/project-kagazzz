/**
 * Segmented control (component-library.md §Segmented Control; audit G-6).
 * The one single-choice picker: a tinted track with the selected segment
 * raised. Wraps onto a second line when the options don't fit.
 */
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';
import { Icon, type IconName } from '../atoms/Icon';

/** One choice in a {@link SegmentedControl}. */
export interface SegmentedOption<T extends string> {
  value: T;
  /** Visible text; omit for icon-only segments (then `ariaLabel` is required). */
  label?: string;
  icon?: IconName;
  /** Accessible name for icon-only segments. */
  ariaLabel?: string;
}

/** Props for {@link SegmentedControl}. */
export interface SegmentedControlProps<T extends string> extends AgentProps {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Id of the visible label element. */
  'aria-labelledby'?: string;
  /** Accessible group name when there is no visible label. */
  'aria-label'?: string;
  /** Builds each segment's agent id; defaults to `${agentId}-${value}`. */
  optionAgentId?: (value: T) => string;
  /** Stretches segments to fill the row. */
  fullWidth?: boolean;
}

/** Single-choice segmented picker. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  optionAgentId,
  fullWidth = false,
  'aria-labelledby': labelledBy,
  'aria-label': ariaLabel,
  ...agent
}: SegmentedControlProps<T>): ReactNode {
  const idFor =
    optionAgentId ?? ((v: T): string | undefined => (agent.agentId ? `${agent.agentId}-${v}` : undefined));
  return (
    <div
      className={clsx('kg-segmented', fullWidth && 'kg-segmented--full')}
      role="group"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      data-agent-id={agent.agentId}
      data-agent-state={value}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={clsx('kg-segmented__btn', active && 'kg-segmented__btn--active')}
            aria-pressed={active}
            aria-label={opt.label ? undefined : opt.ariaLabel}
            onClick={() => onChange(opt.value)}
            {...agentAttrs(
              { agentId: idFor(opt.value), agentAction: agent.agentAction },
              active ? 'selected' : 'idle'
            )}
          >
            {opt.icon && <Icon name={opt.icon} size={20} />}
            {opt.label && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
