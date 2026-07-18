/**
 * Storage donut (F-26) — a dependency-free SVG ring showing each file
 * type's share of total vault bytes, with a legend. Pure presentational;
 * colors come from the data-viz tokens (--chart-1..6), so it themes with
 * light/dark automatically. Arc lengths are stroke-dasharray slices of a
 * single circle, offset cumulatively from 12 o'clock.
 */
import type { ReactNode } from 'react';

/** One ring slice. */
export interface StorageDonutSegment {
  /** Display label (e.g. "PDF"). */
  label: string;
  /** Formatted size (e.g. "6.3 MB"). */
  sizeLabel: string;
  /** Share of the total, 0–1. */
  fraction: number;
}

/** Props for {@link StorageDonut}. */
export interface StorageDonutProps {
  segments: StorageDonutSegment[];
  /** Big number in the ring's center (e.g. total size). */
  centerValue: string;
  /** Caption under the center value (e.g. "4 documents"). */
  centerLabel: string;
  /** Accessible summary of the whole chart. */
  ariaLabel: string;
}

const RADIUS = 60;
const STROKE = 22;
const SIZE = (RADIUS + STROKE / 2) * 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Cycles the six categorical chart tokens. */
function chartColor(index: number): string {
  return `var(--chart-${(index % 6) + 1})`;
}

/** Cumulative arc start-offset (in path units) for each segment. */
function arcOffsets(segments: StorageDonutSegment[]): number[] {
  const offsets: number[] = [];
  segments.reduce((start, segment) => {
    offsets.push(start);
    return start + segment.fraction * CIRCUMFERENCE;
  }, 0);
  return offsets;
}

/** Donut chart of storage usage by file type. */
export function StorageDonut({
  segments,
  centerValue,
  centerLabel,
  ariaLabel,
}: StorageDonutProps): ReactNode {
  const offsets = arcOffsets(segments);

  return (
    <div className="kg-donut" data-agent-id="vault.storage.donut">
      <svg
        className="kg-donut__svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={ariaLabel}
      >
        <circle
          className="kg-donut__track"
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
        />
        <g
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className="kg-donut__ring"
        >
          {segments.map((segment, index) => {
            const length = segment.fraction * CIRCUMFERENCE;
            const dash = `${length} ${CIRCUMFERENCE - length}`;
            return (
              <circle
                key={segment.label}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={chartColor(index)}
                strokeWidth={STROKE}
                strokeDasharray={dash}
                strokeDashoffset={-offsets[index]}
              />
            );
          })}
        </g>
        <text
          className="kg-donut__value"
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {centerValue}
        </text>
        <text
          className="kg-donut__caption"
          x={CENTER}
          y={CENTER + 20}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {centerLabel}
        </text>
      </svg>

      <ul className="kg-donut__legend">
        {segments.map((segment, index) => (
          <li key={segment.label} className="kg-donut__legend-item">
            <span
              className="kg-donut__swatch"
              style={{ background: chartColor(index) }}
              aria-hidden="true"
            />
            <span className="kg-donut__legend-label">{segment.label}</span>
            <span className="kg-donut__legend-size">{segment.sizeLabel}</span>
            <span className="kg-donut__legend-pct">
              {Math.round(segment.fraction * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
