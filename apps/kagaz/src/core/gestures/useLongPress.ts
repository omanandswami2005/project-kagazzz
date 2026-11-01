/**
 * Long-press-to-select (interaction-patterns.md "Long-press (500ms)" row).
 * Extracted from DocumentListItem's original hand-rolled implementation
 * once Quick Notes needed the exact same gesture (2026-07-24) — pointer
 * capture + a finger-drift tolerance + a trailing-click swallow, all
 * subtle enough that copy-pasting it a second time would have been a real
 * regression risk.
 */
import { useEffect, useRef, type PointerEvent } from 'react';

/** interaction-patterns.md "Long-press (500ms)" — enter selection mode on lists. */
const LONG_PRESS_MS = 500;

/**
 * Finger-drift tolerance before a hold is treated as a scroll instead of a
 * long-press. Real touchscreens can't hold perfectly still — without this,
 * ordinary hand tremor during the 500ms hold gets misread by the browser as
 * the start of a scroll gesture, which fires `pointercancel` and silently
 * drops the long-press — the "sometimes it just doesn't select" symptom.
 */
const MOVE_CANCEL_THRESHOLD_PX = 12;

/** Pointer handlers to spread onto the pressable element. */
export interface LongPressBind {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

/** What {@link useLongPress} exposes. */
export interface UseLongPressResult {
  bind: LongPressBind;
  /**
   * Call at the top of the element's own `onClick`; returns `true` if the
   * click was the trailing click of a long-press that already fired (in
   * which case the caller should return without running its normal click
   * behavior) — a pointerup fires a click right after `onLongPress`, and
   * without this a long-press-to-select would also open/toggle the row.
   */
  consumeTrailingClick: () => boolean;
}

/**
 * Fires `onLongPress` after a {@link LONG_PRESS_MS} hold, tolerating small
 * finger drift. Disabled (no-op handlers) when `enabled` is false or
 * `onLongPress` is omitted, and ignores mouse pointers (long-press is a
 * touch affordance; desktop has right-click/keyboard equivalents).
 */
export function useLongPress(
  onLongPress: (() => void) | undefined,
  enabled = true
): UseLongPressResult {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  const clearTimer = (): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // A row can unmount mid-press (list re-sorts, a background refresh swaps
  // in new data, etc.) without ever getting a pointerup/cancel. Without this
  // cleanup the timer keeps running and fires later on a stale closure — a
  // phantom selection with no visible press behind it.
  useEffect(() => clearTimer, []);

  const releaseCapture = (event: PointerEvent<HTMLElement>): void => {
    // Some WebView versions throw releasing a pointer that was never
    // captured (e.g. this handler firing for a plain tap); never let that
    // escape and interrupt the rest of the touch/click sequence.
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Best-effort only.
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (!onLongPress || !enabled || event.pointerType === 'mouse') return;
    fired.current = false;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    // Keep move/up/cancel routed to this element for the held pointer even
    // if the finger drifts a little — without capture, drift can hand the
    // gesture to the scroll container mid-hold, which is what makes
    // long-press feel inconsistent on a real touchscreen.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Best-effort only — the timer/threshold logic below still works
      // without capture, just with less drift tolerance.
    }
    timer.current = setTimeout(() => {
      fired.current = true;
      timer.current = null;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_THRESHOLD_PX) {
      clearTimer();
    }
  };

  const onPointerUpOrCancel = (event: PointerEvent<HTMLElement>): void => {
    clearTimer();
    start.current = null;
    releaseCapture(event);
  };

  const consumeTrailingClick = (): boolean => {
    if (fired.current) {
      fired.current = false;
      return true;
    }
    return false;
  };

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerUpOrCancel,
      onPointerCancel: onPointerUpOrCancel,
    },
    consumeTrailingClick,
  };
}
