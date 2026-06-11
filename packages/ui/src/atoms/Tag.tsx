/**
 * Tag / Chip atom (component-library.md §Tag / Chip).
 * Category, filter, or attribute; selectable (aria-pressed) and removable.
 */
import { clsx } from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';

/** Props for {@link Tag}. */
export interface TagProps extends AgentProps {
  /** Tag text. */
  label: string;
  /** Shows the remove (×) button. */
  removable?: boolean;
  /** Optional custom background color (folder/tag colors from the DB). */
  color?: string;
  /** Selected/active state for filter tags. */
  selected?: boolean;
  /** Remove handler. */
  onRemove?: () => void;
  /** Click handler — when present the tag renders as a toggle button. */
  onClick?: () => void;
}

/** Category/filter chip. */
export function Tag({
  label,
  removable = false,
  color,
  selected = false,
  onRemove,
  onClick,
  ...agent
}: TagProps): ReactNode {
  const style: CSSProperties | undefined = color
    ? { backgroundColor: color }
    : undefined;
  const state = selected ? 'selected' : 'idle';
  const content = (
    <>
      <span className="kg-tag__label">{label}</span>
      {removable && (
        <button
          type="button"
          className="kg-tag__remove"
          aria-label={`Remove ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        >
          ×
        </button>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={clsx('kg-tag', selected && 'kg-tag--selected')}
        style={style}
        aria-pressed={selected}
        onClick={onClick}
        {...agentAttrs(agent, state, label)}
      >
        {content}
      </button>
    );
  }
  return (
    <span
      className={clsx('kg-tag', selected && 'kg-tag--selected')}
      style={style}
      {...agentAttrs(agent, state, label)}
    >
      {content}
    </span>
  );
}
