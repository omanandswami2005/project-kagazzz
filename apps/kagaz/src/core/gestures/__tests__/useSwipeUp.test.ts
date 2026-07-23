import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useSwipeUp } from '../useSwipeUp';

function fakeEvent(
  overrides: Partial<{
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
  }>
): ReactPointerEvent<HTMLElement> {
  const target = document.createElement('div');
  return {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 0,
    clientY: 0,
    ...overrides,
    currentTarget: target,
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
    releasePointerCapture: vi.fn(),
  } as unknown as ReactPointerEvent<HTMLElement>;
}

describe('useSwipeUp', () => {
  it('tracks dragY (negative) once past the axis deadzone on an upward drag', () => {
    const { result } = renderHook(() => useSwipeUp({ onSwipeUp: vi.fn() }));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 200 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 102, clientY: 160 })));
    expect(result.current.dragY).toBe(-40);
    expect(result.current.isDragging).toBe(true);
  });

  it('ignores mouse pointers', () => {
    const { result } = renderHook(() => useSwipeUp({ onSwipeUp: vi.fn() }));
    act(() =>
      result.current.bind.onPointerDown(
        fakeEvent({ clientX: 100, clientY: 200, pointerType: 'mouse' })
      )
    );
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 102, clientY: 160 })));
    expect(result.current.dragY).toBe(0);
  });

  it('locks to the horizontal axis and never sets dragY on a mostly-horizontal drag', () => {
    const { result } = renderHook(() => useSwipeUp({ onSwipeUp: vi.fn() }));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 200 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 160, clientY: 202 })));
    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragY).toBe(0);
  });

  it('clamps to 0 on a downward drag (never tracks positive dragY)', () => {
    const { result } = renderHook(() => useSwipeUp({ onSwipeUp: vi.fn() }));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 200 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 240 })));
    expect(result.current.dragY).toBe(0);
  });

  it('fires onSwipeUp when released past the commit threshold', () => {
    const onSwipeUp = vi.fn();
    const { result } = renderHook(() => useSwipeUp({ onSwipeUp }));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 200 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 130 })));
    act(() => result.current.bind.onPointerUp(fakeEvent({ clientX: 100, clientY: 130 })));
    expect(onSwipeUp).toHaveBeenCalledOnce();
    expect(result.current.dragY).toBe(0);
  });

  it('does not fire when released short of the threshold', () => {
    const onSwipeUp = vi.fn();
    const { result } = renderHook(() => useSwipeUp({ onSwipeUp }));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 200 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 180 })));
    act(() => result.current.bind.onPointerUp(fakeEvent({ clientX: 100, clientY: 180 })));
    expect(onSwipeUp).not.toHaveBeenCalled();
  });

  it('fires onThresholdCross exactly once per crossing', () => {
    const onThresholdCross = vi.fn();
    const { result } = renderHook(() =>
      useSwipeUp({ onSwipeUp: vi.fn(), onThresholdCross })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 200 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 130 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 120 })));
    expect(onThresholdCross).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all while disabled', () => {
    const onSwipeUp = vi.fn();
    const { result } = renderHook(() => useSwipeUp({ onSwipeUp, disabled: true }));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 200 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 100 })));
    act(() => result.current.bind.onPointerUp(fakeEvent({ clientX: 100, clientY: 100 })));
    expect(onSwipeUp).not.toHaveBeenCalled();
    expect(result.current.dragY).toBe(0);
  });
});
