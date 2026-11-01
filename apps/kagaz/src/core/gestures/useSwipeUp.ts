/**
 * Vertical swipe-up gesture (UX-16, Recent strip → Tools). Same pointer-
 * capture/axis-lock shape as {@link useSwipeGesture}, but a separate small
 * hook rather than a generalized 4-direction version of it: this is the
 * only vertical-swipe call site in the app, and a dedicated hook is
 * simpler than threading a direction axis through the horizontal one.
 *
 * Only claims the gesture once a drag is confirmed vertical *and* upward
 * past the deadzone — anything else (a rightward/leftward carousel drag,
 * or a downward flick) is left completely alone. The card this binds to
 * must also set `touch-action: pan-x` in CSS: without it, the browser's
 * own vertical scroll (the page's IonContent) starts natively on
 * pointerdown regardless of this hook's internal state, racing this
 * gesture. `pan-x` tells the browser "only native-scroll this element
 * horizontally," freeing vertical touch input on the card for this hook
 * to read without a `preventDefault` fight — the standard technique for a
 * custom-gestured card living inside a vertically-scrolling page.
 */
import { useRef, useState, type PointerEvent } from 'react';

/** Upward drag distance (px) that commits the swipe-up. */
export const SWIPE_UP_COMMIT_PX = 56;
/** Movement (px) before the gesture's axis (vertical vs. horizontal) locks. */
const AXIS_DEADZONE_PX = 10;

/** Options for {@link useSwipeUp}. */
export interface UseSwipeUpOptions {
  onSwipeUp: () => void;
  /** Fires once the first time a drag crosses the commit threshold (for haptics). */
  onThresholdCross?: () => void;
  disabled?: boolean;
}

/** What {@link useSwipeUp} exposes to the card that binds it. */
export interface UseSwipeUpResult {
  /** 0 when idle; negative while dragging up (never positive). */
  dragY: number;
  isDragging: boolean;
  bind: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  };
}

/** Drives a one-card swipe-up gesture; the caller renders `dragY`. */
export function useSwipeUp({
  onSwipeUp,
  onThresholdCross,
  disabled = false,
}: UseSwipeUpOptions): UseSwipeUpResult {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const axis = useRef<'vertical' | 'horizontal' | null>(null);
  const crossed = useRef(false);

  const reset = (): void => {
    start.current = null;
    axis.current = null;
    crossed.current = false;
    setIsDragging(false);
    setDragY(0);
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
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    axis.current = null;
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;

    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_DEADZONE_PX && Math.abs(dy) < AXIS_DEADZONE_PX) {
        return;
      }
      axis.current = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
      if (axis.current === 'vertical') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Best-effort — dragging still works without capture.
        }
        setIsDragging(true);
      }
    }
    if (axis.current !== 'vertical') return;
    // Only track upward movement; a downward drag just relaxes back to 0.
    const clamped = Math.min(0, dy);
    setDragY(clamped);
    if (clamped <= -SWIPE_UP_COMMIT_PX && !crossed.current) {
      crossed.current = true;
      onThresholdCross?.();
    } else if (clamped > -SWIPE_UP_COMMIT_PX) {
      crossed.current = false;
    }
  };

  const onPointerUpOrCancel = (event: PointerEvent<HTMLElement>): void => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) {
      reset();
      return;
    }
    if (axis.current === 'vertical') {
      releaseCapture(event);
      if (dragY <= -SWIPE_UP_COMMIT_PX) {
        onSwipeUp();
      }
    }
    reset();
  };

  return {
    dragY,
    isDragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerUpOrCancel,
      onPointerCancel: onPointerUpOrCancel,
    },
  };
}
