import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { usePageGestures } from '../usePageGestures';

const ev = (pointerId: number, x: number, y = 0): PointerEvent<HTMLElement> =>
  ({ pointerId, clientX: x, clientY: y }) as PointerEvent<HTMLElement>;

describe('usePageGestures (VW-10)', () => {
  it('double-tap toggles 2× zoom', () => {
    const { result } = renderHook(() => usePageGestures(vi.fn()));
    for (let i = 0; i < 2; i++) {
      act(() => result.current.bind.onPointerDown(ev(1, 50)));
      act(() => result.current.bind.onPointerUp(ev(1, 50)));
    }
    expect(result.current.zoom).toBe(2);
  });

  it('pinch zooms within 1–4×', () => {
    const { result } = renderHook(() => usePageGestures(vi.fn()));
    act(() => result.current.bind.onPointerDown(ev(1, 100)));
    act(() => result.current.bind.onPointerDown(ev(2, 200)));
    act(() => result.current.bind.onPointerMove(ev(2, 400)));
    expect(result.current.zoom).toBe(3);
    act(() => result.current.bind.onPointerMove(ev(2, 900)));
    expect(result.current.zoom).toBe(4);
  });

  it('a horizontal swipe at 1× asks for the next document', () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => usePageGestures(onSwipe));
    act(() => result.current.bind.onPointerDown(ev(1, 300, 100)));
    act(() => result.current.bind.onPointerUp(ev(1, 100, 110)));
    expect(onSwipe).toHaveBeenCalledWith('next');
  });
});
