/**
 * Storage by type (screen audit ST-2/ST-7/ST-8): one horizontal stacked bar
 * plus a legend with each type's icon, size and share. Replaces the donut,
 * which spent 200 px to say "almost everything is PDF". Segments grow in
 * from the left on first paint (motion tokens, so reduced-motion / Simple
 * mode show them at once). Colours are the --chart-1..6 data-viz tokens.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@kagaz/ui';
import { documentTypeIcon } from '@/core/components/DocumentThumb';

/** One bar segment. */
export interface StorageBarSegment {
  /** File type as stored (e.g. "pdf"). */
  fileType: string;
  /** Formatted size (e.g. "6.3 MB"). */
  sizeLabel: string;
  /** Share of the total, 0–1. */
  fraction: number;
}

/** Props for {@link StorageBar}. */
export interface StorageBarProps {
  segments: StorageBarSegment[];
  /** Accessible summary of the whole chart. */
  ariaLabel: string;
}

const chartColor = (index: number): string => `var(--chart-${(index % 6) + 1})`;

/** Stacked bar + legend of storage use by file type. */
export function StorageBar({ segments, ariaLabel }: StorageBarProps): ReactNode {
  return (
    <div className="kg-storage-bar">
      <div className="kg-storage-bar__track" role="img" aria-label={ariaLabel}>
        {segments.map((s, i) => (
          <span
            key={s.fileType}
            className="kg-storage-bar__segment"
            style={{ width: `${s.fraction * 100}%`, background: chartColor(i), '--i': i } as CSSProperties}
          />
        ))}
      </div>
      <ul className="kg-storage-bar__legend">
        {segments.map((s, i) => (
          <li key={s.fileType} className="kg-storage-bar__item">
            <span className="kg-storage-bar__icon" style={{ color: chartColor(i) }} aria-hidden="true">
              <Icon name={documentTypeIcon(s.fileType)} size={20} />
            </span>
            <span className="kg-storage-bar__label">{s.fileType.toUpperCase()}</span>
            <span className="kg-storage-bar__size">{s.sizeLabel}</span>
            <span className="kg-storage-bar__pct">{Math.round(s.fraction * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
