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
import { useEffect, useState } from 'react';

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
 * Takes the element itself (from a callback ref / state), not a ref object:
 * the container can mount after the first render — the vault list starts as
 * a plain list until IonContent's scroll element resolves — and a ref object
 * gave the effect no way to notice, so the grid stuck at one column
 * (device report 2026-11-19).
 */
export function useGridColumns(el: HTMLElement | null, isGrid: boolean): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    if (!isGrid) {
      return undefined;
    }
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
      // Ionic hides a page that is under another one (display: none) and the
      // observer then reports width 0. Taking that as "1 column" made the grid
      // collapse to one column after opening a document and coming back.
      // A hidden list keeps its last real layout instead.
      if (entry && entry.contentRect.width > 0) {
        setColumns(columnsForWidth(entry.contentRect.width));
      }
    });
    observer.observe(el);
    return (): void => observer.disconnect();
  }, [el, isGrid]);

  // Derived, not stored: falling back to 1 here (rather than resetting
  // `columns` state when isGrid flips false) means a stale grid measurement
  // can never leak into a non-grid render.
  return isGrid ? columns : 1;
}
