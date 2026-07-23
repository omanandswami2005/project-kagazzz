import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useSwipeGesture } from '../useSwipeGesture';

/** jsdom's real getBoundingClientRect is all-zero; stub a realistic row
 * width so the commit threshold behaves like it would on a real screen. */
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 300,
    height: 56,
    top: 0,
    left: 0,
    right: 300,
    bottom: 56,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

/** Minimal fake matching what the hook reads off a React PointerEvent. */
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

describe('useSwipeGesture', () => {
  it('tracks dragX once past the axis deadzone on a horizontal drag', () => {
    const { result } = renderHook(() =>
      useSwipeGesture({ onCommit: vi.fn(), enabled: { left: true, right: true } })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 140, clientY: 52 })));
    expect(result.current.dragX).toBe(40);
    expect(result.current.isDragging).toBe(true);
  });

  it('ignores mouse pointers', () => {
    const { result } = renderHook(() =>
      useSwipeGesture({ onCommit: vi.fn(), enabled: { left: true, right: true } })
    );
    act(() =>
      result.current.bind.onPointerDown(
        fakeEvent({ clientX: 100, clientY: 50, pointerType: 'mouse' })
      )
    );
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 140, clientY: 52 })));
    expect(result.current.dragX).toBe(0);
  });

  it('locks to the vertical axis and never sets dragX when the drag is mostly vertical', () => {
    const { result } = renderHook(() =>
      useSwipeGesture({ onCommit: vi.fn(), enabled: { left: true, right: true } })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 100 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 102, clientY: 160 })));
    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragX).toBe(0);
  });

  it('commits right past the threshold on release', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onCommit, enabled: { left: true, right: true } })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 200, clientY: 50 })));
    act(() => result.current.bind.onPointerUp(fakeEvent({ clientX: 200, clientY: 50 })));
    expect(onCommit).toHaveBeenCalledWith('right');
    expect(result.current.dragX).toBe(0);
  });

  it('commits left past the threshold on release', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onCommit, enabled: { left: true, right: true } })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 200, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 50 })));
    act(() => result.current.bind.onPointerUp(fakeEvent({ clientX: 100, clientY: 50 })));
    expect(onCommit).toHaveBeenCalledWith('left');
  });

  it('springs back without committing when released short of the threshold', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onCommit, enabled: { left: true, right: true } })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 130, clientY: 50 })));
    act(() => result.current.bind.onPointerUp(fakeEvent({ clientX: 130, clientY: 50 })));
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.dragX).toBe(0);
  });

  it('never commits toward a side with no action bound, even past the threshold', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onCommit, enabled: { left: false, right: true } })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 200, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 50 })));
    act(() => result.current.bind.onPointerUp(fakeEvent({ clientX: 100, clientY: 50 })));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('resists dragging toward a disabled side (rubber-band, not a hard stop)', () => {
    const { result } = renderHook(() =>
      useSwipeGesture({ onCommit: vi.fn(), enabled: { left: false, right: true } })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 200, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 100, clientY: 50 })));
    // Full delta is -100; resisted to a quarter.
    expect(result.current.dragX).toBe(-25);
  });

  it('does nothing at all while disabled', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({
        onCommit,
        enabled: { left: true, right: true },
        disabled: true,
      })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 200, clientY: 50 })));
    expect(result.current.dragX).toBe(0);
    expect(result.current.isDragging).toBe(false);
  });

  it('fires onThresholdCross exactly once per crossing, per side', () => {
    const onThresholdCross = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({
        onCommit: vi.fn(),
        enabled: { left: true, right: true },
        onThresholdCross,
      })
    );
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 200, clientY: 50 })));
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 210, clientY: 50 })));
    expect(onThresholdCross).toHaveBeenCalledTimes(1);
    expect(onThresholdCross).toHaveBeenCalledWith('right');
  });
});
