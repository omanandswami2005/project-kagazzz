/**
 * Live column count for the vault's responsive card grid (UX pass,
 * 2026-07-23, virtualization support). `.kg-vault__list--grid`'s CSS is
 * `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))` — a
 * viewport-width-dependent column count with no fixed number, so row-based
 * virtualization (grouping items into virtual rows of N columns) needs to
 * know the *actual* rendered column count, not a guess. A ResizeObserver on
 * the container recomputes it from real available width, matching the CSS
 * formula for `auto-fill` grid tracks.
 */
import { useEffect, useState, type RefObject } from 'react';

const MIN_CARD_PX = 140;
const GAP_PX = 12; // --space-3

/**
 * Pure column-count formula matching `repeat(auto-fill, minmax(140px, 1fr))`:
 * as many 140px tracks (plus the gaps between them) as fit in the available
 * width, minimum 1. Exported standalone so it's testable without DOM/layout
 * (jsdom has neither) — the hook below is thin wiring on top of this.
 */
export function columnsForWidth(width: number): number {
  const fit = Math.floor((width + GAP_PX) / (MIN_CARD_PX + GAP_PX));
  return Math.max(1, fit);
}

/**
 * Tracks a container's live grid column count (1 for non-grid layouts).
 * Takes the container ref rather than creating one, so callers that also
 * need that ref for something else (e.g. measuring scroll offset for
 * virtualization) share a single ref/element instead of juggling two.
 */
export function useGridColumns(
  containerRef: RefObject<HTMLElement | null>,
  isGrid: boolean
): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    if (!isGrid) {
      return undefined;
    }
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    // No manual priming call: ResizeObserver.observe() always fires its
    // callback at least once on the next microtask, even for an unchanged
    // size, so this alone covers the initial measurement too — one state
    // update path, not two (avoids setting state synchronously in the
    // effect body).
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setColumns(columnsForWidth(entry.contentRect.width));
      }
    });
    observer.observe(el);
    return (): void => observer.disconnect();
  }, [containerRef, isGrid]);

  // Derived, not stored: falling back to 1 here (rather than resetting
  // `columns` state when isGrid flips false) means a stale grid measurement
  // can never leak into a non-grid render.
  return isGrid ? columns : 1;
}
