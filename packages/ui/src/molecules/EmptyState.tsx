/**
 * Empty-state molecule (component-library.md §Empty State; audit G-8).
 * One shape for every "nothing here yet" surface: an object-role icon, a
 * title, an optional hint and an optional primary action, aligned to the
 * top third so the eye lands on it without scrolling.
 */
import type { ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';
import { Icon, type IconName } from '../atoms/Icon';

/** Props for {@link EmptyState}. */
export interface EmptyStateProps extends AgentProps {
  /** Illustration icon (rendered in the object-icon colour). */
  icon: IconName;
  /** One-line headline. */
  title: string;
  /** Optional explanation or next step. */
  hint?: string;
  /** Optional call to action (usually a primary `Button`). */
  action?: ReactNode;
}

/** Consistent empty state: icon, title, hint, optional action. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  ...agent
}: EmptyStateProps): ReactNode {
  return (
    <div className="kg-empty" {...agentAttrs(agent)}>
      <span className="kg-empty__icon" aria-hidden="true">
        <Icon name={icon} size={48} />
      </span>
      <p className="kg-empty__title">{title}</p>
      {hint && <p className="kg-empty__hint">{hint}</p>}
      {action && <div className="kg-empty__action">{action}</div>}
    </div>
  );
}
