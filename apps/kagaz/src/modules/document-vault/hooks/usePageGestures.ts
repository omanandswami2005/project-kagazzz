/**
 * Direct manipulation on the viewer's pages (audit VW-10): double-tap
 * toggles 2× zoom, two-finger pinch zooms 1–4×, and — only at 1× — a
 * horizontal swipe moves to the previous / next document. Pointer events
 * only; no gesture library.
 */
import { useRef, useState, type PointerEvent } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_MS = 300;
/** Horizontal travel (px) that counts as a "next document" swipe. */
const SWIPE_PX = 80;

/** What {@link usePageGestures} returns. */
export interface PageGestures {
  zoom: number;
  bind: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  };
}

const clamp = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Zoom + swipe-between-documents on a page container. */
export function usePageGestures(onSwipe: (direction: 'next' | 'previous') => void): PageGestures {
  const [zoom, setZoom] = useState(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);

  const distance = (): number => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const end = (e: PointerEvent<HTMLElement>): void => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  return {
    zoom,
    bind: {
      onPointerDown: (e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          pinchStart.current = { distance: distance(), zoom };
          swipeStart.current = null;
        } else {
          swipeStart.current = { x: e.clientX, y: e.clientY };
        }
      },
      onPointerMove: (e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const start = pinchStart.current;
        if (start && start.distance > 0) setZoom(clamp((start.zoom * distance()) / start.distance));
      },
      onPointerUp: (e) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        const wasPinch = pinchStart.current !== null || pointers.current.size > 1;
        end(e);
        if (wasPinch || !start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (zoom === 1 && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) {
          onSwipe(dx < 0 ? 'next' : 'previous');
          return;
        }
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            setZoom((z) => (z > 1 ? 1 : 2));
            lastTap.current = 0;
          } else {
            lastTap.current = now;
          }
        }
      },
      onPointerCancel: end,
    },
  };
}
