/**
 * Spinner atom (component-library.md §Spinner / Loader).
 * role="status" in an aria-live="polite" region. Spinners longer than 2s
 * without progress are an anti-pattern — prefer ProgressBar + skeleton.
 */
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/** Props for {@link Spinner}. */
export interface SpinnerProps {
  /** Spinner size: sm=16, md=24, lg=40. */
  size?: 'sm' | 'md' | 'lg';
  /** Spinner color (defaults to the primary color token). */
  color?: string;
  /** Screen-reader label. */
  label?: string;
}

/** Indeterminate loading indicator. */
export function Spinner({
  size = 'md',
  color,
  label = 'Loading...',
}: SpinnerProps): ReactNode {
  return (
    <span aria-live="polite">
      <span
        className={clsx('kg-spinner', `kg-spinner--${size}`)}
        style={color ? { borderTopColor: color } : undefined}
        role="status"
        aria-label={label}
      />
    </span>
  );
}
