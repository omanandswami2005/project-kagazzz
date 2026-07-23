/**
 * Horizontal swipe-to-act gesture (F-88). Pointer-events based, mirroring
 * DocumentListItem's existing long-press pointer-capture pattern rather
 * than pulling in Ionic's internal Gesture class or a new dependency —
 * this app already trusts hand-rolled pointer tracking for touch
 * interactions (same drift/capture reasoning applies here).
 *
 * A single active pointer's horizontal delta drives `dragX`; the first
 * ~10px of movement decides whether the gesture is horizontal (a swipe) or
 * vertical (a scroll) and locks that axis for the rest of the gesture —
 * without this, a mostly-vertical scroll starting on a swipeable row would
 * randomly also drag it sideways.
 */
import { useRef, useState, type PointerEvent } from 'react';

/** Minimum drag distance (px) that commits a swipe, regardless of row width. */
export const SWIPE_COMMIT_PX = 88;
/** Or this fraction of the row's own width, whichever is smaller — so short
 * rows on narrow screens don't require an unreasonably long drag. */
const SWIPE_COMMIT_FRACTION = 0.4;
/** Movement (px) before the gesture's axis (horizontal vs. vertical) locks. */
const AXIS_DEADZONE_PX = 10;
/** How far a drag can overshoot toward a side with no action, for a soft
 * rubber-band feel instead of a hard stop. */
const DISABLED_SIDE_RESISTANCE = 0.25;

export type SwipeSide = 'left' | 'right';

/** Which sides have an action bound — a side with none never commits. */
export interface SwipeSideEnabled {
  left: boolean;
  right: boolean;
}

/** Options for {@link useSwipeGesture}. */
export interface UseSwipeGestureOptions {
  /** Fires once a drag release commits past the threshold on either side. */
  onCommit: (side: SwipeSide) => void;
  enabled: SwipeSideEnabled;
  /** Fires the first time a drag crosses the commit threshold (for haptics). */
  onThresholdCross?: (side: SwipeSide) => void;
  /** Suppresses the gesture entirely (e.g. multi-select mode). */
  disabled?: boolean;
}

/** What {@link useSwipeGesture} exposes to the row that binds it. */
export interface UseSwipeGestureResult {
  /** Current horizontal offset in px; 0 when idle. Positive = dragged right. */
  dragX: number;
  isDragging: boolean;
  bind: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  };
}

/** Drives a one-row swipe-to-act gesture; the caller renders `dragX`. */
export function useSwipeGesture({
  onCommit,
  enabled,
  onThresholdCross,
  disabled = false,
}: UseSwipeGestureOptions): UseSwipeGestureResult {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; width: number } | null>(
    null
  );
  const axis = useRef<'horizontal' | 'vertical' | null>(null);
  const crossedSide = useRef<SwipeSide | null>(null);

  const reset = (): void => {
    start.current = null;
    axis.current = null;
    crossedSide.current = null;
    setIsDragging(false);
    setDragX(0);
  };

  const releaseCapture = (event: PointerEvent<HTMLElement>): void => {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Best-effort only.
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (disabled || event.pointerType === 'mouse') return;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      width: event.currentTarget.getBoundingClientRect().width || 1,
    };
    axis.current = null;
    crossedSide.current = null;
  };

  const commitThreshold = (width: number): number =>
    Math.min(SWIPE_COMMIT_PX, width * SWIPE_COMMIT_FRACTION);

  const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;

    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_DEADZONE_PX && Math.abs(dy) < AXIS_DEADZONE_PX) {
        return;
      }
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (axis.current === 'horizontal') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Best-effort — dragging still works without capture.
        }
        setIsDragging(true);
      }
    }
    if (axis.current !== 'horizontal') return;

    const clamped =
      dx > 0 && !enabled.right
        ? dx * DISABLED_SIDE_RESISTANCE
        : dx < 0 && !enabled.left
          ? dx * DISABLED_SIDE_RESISTANCE
          : dx;
    setDragX(clamped);

    const threshold = commitThreshold(s.width);
    const side: SwipeSide | null =
      clamped > threshold ? 'right' : clamped < -threshold ? 'left' : null;
    if (side && side !== crossedSide.current && enabled[side]) {
      crossedSide.current = side;
      onThresholdCross?.(side);
    } else if (!side) {
      crossedSide.current = null;
    }
  };

  const onPointerUpOrCancel = (event: PointerEvent<HTMLElement>): void => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) {
      reset();
      return;
    }
    if (axis.current === 'horizontal') {
      const threshold = commitThreshold(s.width);
      releaseCapture(event);
      if (dragX > threshold && enabled.right) {
        onCommit('right');
      } else if (dragX < -threshold && enabled.left) {
        onCommit('left');
      }
    }
    reset();
  };

  return {
    dragX,
    isDragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerUpOrCancel,
      onPointerCancel: onPointerUpOrCancel,
    },
  };
}
