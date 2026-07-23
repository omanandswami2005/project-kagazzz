/**
 * "Coverflow-lite" scroll effect for the Recent strip (UX-16): as the row
 * scrolls, each card scales/fades by its distance from the row's center —
 * cheap (transform + opacity only, GPU-composited, no layout) and driven
 * by the browser's own native horizontal scroll/scroll-snap rather than a
 * hijacked pointer gesture, so it costs nothing on mid-range Android and
 * never fights the carousel's native fling/snap physics.
 *
 * Deliberately scale+opacity, not a true 3D `rotateY` coverflow: a
 * perspective transform is meaningfully more expensive to composite and
 * buys little on a document-thumbnail strip, which this app's mid-range
 * Android performance budget (CONTRIBUTING.md) doesn't have room for.
 */
import { useEffect, type RefObject } from 'react';

/** How much a fully-off-center card shrinks (1 → 1 - this). */
const MAX_SCALE_DROP = 0.12;
/** How much a fully-off-center card fades (1 → 1 - this). */
const MAX_OPACITY_DROP = 0.35;

/** Applies the coverflow scale/opacity to every direct `<li>` child of `containerRef`. */
export function useCoverflowScroll(
  containerRef: RefObject<HTMLElement | null>,
  /** Re-runs the initial measurement when the visible card set changes. */
  deps: readonly unknown[]
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let rafId = 0;
    const update = (): void => {
      rafId = 0;
      const rect = container.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const half = rect.width / 2 || 1;
      for (const child of Array.from(container.children)) {
        if (!(child instanceof HTMLElement)) continue;
        const childRect = child.getBoundingClientRect();
        const childCenter = childRect.left + childRect.width / 2;
        const distance = Math.min(1, Math.abs(childCenter - center) / half);
        child.style.transform = `scale(${(1 - distance * MAX_SCALE_DROP).toFixed(3)})`;
        child.style.opacity = (1 - distance * MAX_OPACITY_DROP).toFixed(3);
      }
    };
    const onScroll = (): void => {
      if (rafId) return;
      rafId = requestAnimationFrame(update);
    };

    update();
    container.addEventListener('scroll', onScroll, { passive: true });
    // jsdom has no ResizeObserver (see useGridColumns) — feature-detect so
    // this hook degrades to scroll-only reflow in that environment.
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null;
    resizeObserver?.observe(container);

    return (): void => {
      container.removeEventListener('scroll', onScroll);
      resizeObserver?.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is the caller's explicit re-measure trigger
  }, [containerRef, ...deps]);
}
