/**
 * ProgressBar atom (component-library.md §Progress Bar).
 * role="progressbar" with aria-value* (omitted when indeterminate).
 */
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/** Props for {@link ProgressBar}. */
export interface ProgressBarProps {
  /** Current progress (0–max). */
  value?: number;
  /** Maximum value. */
  max?: number;
  /** Color variant. */
  variant?: 'default' | 'success' | 'danger';
  /** Bar height: sm=4px, md=8px. */
  size?: 'sm' | 'md';
  /** Shows the percentage text next to the bar. */
  showLabel?: boolean;
  /** Animating indeterminate bar (unknown duration). */
  indeterminate?: boolean;
  /** Describes the operation (e.g. "Uploading document"). */
  'aria-label': string;
}

/** Determinate/indeterminate operation progress. */
export function ProgressBar({
  value = 0,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  indeterminate = false,
  'aria-label': ariaLabel,
}: ProgressBarProps): ReactNode {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  return (
    <div className="kg-progress-wrap">
      <div
        className={clsx(
          'kg-progress',
          `kg-progress--${variant}`,
          `kg-progress--${size}`,
          indeterminate && 'kg-progress--indeterminate'
        )}
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : max}
        aria-valuenow={indeterminate ? undefined : clamped}
      >
        <div
          className="kg-progress__fill"
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
      {showLabel && !indeterminate && (
        <span className="kg-progress__label">{percent}%</span>
      )}
    </div>
  );
}
