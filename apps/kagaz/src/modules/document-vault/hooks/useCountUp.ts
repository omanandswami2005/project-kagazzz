/**
 * ST-7: a number that counts up to its value once, on first show. Skipped
 * (shows the final value at once) under prefers-reduced-motion and Simple
 * mode — the same rule the motion tokens follow.
 */
import { useEffect, useState } from 'react';

const DURATION_MS = 600;

function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const simple = document.documentElement.getAttribute('data-density') === 'simple';
  return !reduced && !simple;
}

/** Returns `target` scaled by an ease-out progress from 0 to 1. */
export function useCountUp(target: number): number {
  const [animate] = useState(motionAllowed);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!animate) return undefined;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      setValue(target * (1 - (1 - p) ** 3));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return (): void => cancelAnimationFrame(frame);
  }, [animate, target]);
  return animate ? value : target;
}
