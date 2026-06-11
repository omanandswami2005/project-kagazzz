/**
 * Badge atom (component-library.md §Badge).
 * Short status indicator or count (PDF, Uploaded, 3, …).
 */
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/** Props for {@link Badge}. */
export interface BadgeProps {
  /** Color variant. */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  /** Badge size. */
  size?: 'sm' | 'md';
  /** Badge content (text or number). Ignored when `dot`. */
  children?: ReactNode;
  /** Renders as a small dot indicator. */
  dot?: boolean;
  /** Accessible name when content alone is ambiguous (required for dot). */
  'aria-label'?: string;
}

/** Non-interactive status indicator. */
export function Badge({
  variant = 'default',
  size = 'md',
  children,
  dot = false,
  'aria-label': ariaLabel,
}: BadgeProps): ReactNode {
  return (
    <span
      className={clsx(
        'kg-badge',
        `kg-badge--${variant}`,
        `kg-badge--${size}`,
        dot && 'kg-badge--dot'
      )}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
    >
      {dot ? null : children}
    </span>
  );
}
