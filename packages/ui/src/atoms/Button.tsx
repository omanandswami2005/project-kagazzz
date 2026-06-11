/**
 * Button atom (component-library.md §Button).
 * One primary action per screen (design-principles.md #1); icon-only is
 * never used in primary flows (#2) and requires an aria-label.
 */
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { agentAttrs, type AgentProps } from '../agent-props';
import { Spinner } from './Spinner';

/** Props for {@link Button}. */
export interface ButtonProps extends AgentProps {
  /** Visual style variant. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon-only';
  /** Button size. */
  size?: 'sm' | 'md' | 'lg';
  /** Disables the button. */
  disabled?: boolean;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Renders an icon-only circular button (aria-label becomes mandatory). */
  iconOnly?: boolean;
  /** Stretches to fill the container. */
  fullWidth?: boolean;
  /** Click handler. */
  onClick?: () => void;
  /** Button label content. */
  children?: ReactNode;
  /** HTML button type. */
  type?: 'button' | 'submit' | 'reset';
  /** Accessible name — required for icon-only buttons. */
  'aria-label'?: string;
}

/** Action-triggering button with full agent + a11y surface. */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconOnly = false,
  fullWidth = false,
  onClick,
  children,
  type = 'button',
  'aria-label': ariaLabel,
  ...agent
}: ButtonProps): ReactNode {
  const state = loading ? 'loading' : disabled ? 'disabled' : 'idle';
  const blocked = disabled || loading;
  return (
    <button
      type={type}
      className={clsx(
        'kg-btn',
        `kg-btn--${iconOnly ? 'icon-only' : variant}`,
        `kg-btn--${size}`,
        fullWidth && 'kg-btn--full'
      )}
      disabled={blocked}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      {...agentAttrs(agent, state)}
    >
      {loading ? (
        <Spinner size="sm" label="Loading" />
      ) : (
        icon && (
          <span className="kg-btn__icon" aria-hidden="true">
            {icon}
          </span>
        )
      )}
      {!iconOnly && children !== undefined && (
        <span className="kg-btn__label">{children}</span>
      )}
      {iconOnly && !loading && children}
    </button>
  );
}
