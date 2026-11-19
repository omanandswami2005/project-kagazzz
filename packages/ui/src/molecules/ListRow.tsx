/**
 * Navigation / action list row (component-library.md §List Row; audit
 * SE-2). Leading icon, title, optional hint, trailing chevron — so a list
 * of destinations reads as a list, not a stack of equal-weight buttons.
 */
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';
import { Icon, type IconName } from '../atoms/Icon';
import { Spinner } from '../atoms/Spinner';

/** Props for {@link ListRow}. */
export interface ListRowProps extends AgentProps {
  icon?: IconName;
  title: string;
  /** Secondary line (status or explanation). */
  hint?: ReactNode;
  /** `danger` colours the icon and title for destructive rows. */
  tone?: 'default' | 'danger';
  /** Shows a spinner in place of the chevron and blocks taps. */
  loading?: boolean;
  disabled?: boolean;
  /** Hides the trailing chevron (for rows that act in place). */
  noChevron?: boolean;
  onClick: () => void;
}

/** Tappable row with icon, title, hint and chevron. */
export function ListRow({
  icon,
  title,
  hint,
  tone = 'default',
  loading = false,
  disabled = false,
  noChevron = false,
  onClick,
  ...agent
}: ListRowProps): ReactNode {
  const blocked = disabled || loading;
  return (
    <button
      type="button"
      className={clsx('kg-list-row', tone === 'danger' && 'kg-list-row--danger')}
      disabled={blocked}
      aria-busy={loading || undefined}
      onClick={onClick}
      {...agentAttrs(agent, loading ? 'loading' : disabled ? 'disabled' : 'idle')}
    >
      {icon && (
        <span className="kg-list-row__icon" aria-hidden="true">
          <Icon name={icon} size={24} />
        </span>
      )}
      <span className="kg-list-row__text">
        <span className="kg-list-row__title">{title}</span>
        {hint && <span className="kg-list-row__hint">{hint}</span>}
      </span>
      {loading ? (
        <Spinner size="sm" label={title} />
      ) : (
        !noChevron && (
          <span className="kg-list-row__chevron" aria-hidden="true">
            <Icon name="ChevronRight" size={20} />
          </span>
        )
      )}
    </button>
  );
}
