import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useLongPress } from '../useLongPress';

/** Minimal fake matching what the hook reads off a React PointerEvent. */
function fakeEvent(
  overrides: Partial<{
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
  }> = {}
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

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useLongPress', () => {
  it('fires onLongPress after holding for 500ms', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    expect(onLongPress).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it('does not fire if released before 500ms', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    act(() => result.current.bind.onPointerUp(fakeEvent({ clientX: 100, clientY: 50 })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels on drift past the move threshold (tremor-tolerant scroll disambiguation)', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    // Small drift within tolerance must not cancel.
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 105, clientY: 52 })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onLongPress).toHaveBeenCalledOnce();

    onLongPress.mockClear();
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    // A real scroll-sized drift cancels the hold.
    act(() => result.current.bind.onPointerMove(fakeEvent({ clientX: 130, clientY: 50 })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores mouse pointers', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    act(() =>
      result.current.bind.onPointerDown(
        fakeEvent({ clientX: 100, clientY: 50, pointerType: 'mouse' })
      )
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, false));
    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('consumeTrailingClick swallows exactly the click right after a fired long-press', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    expect(result.current.consumeTrailingClick()).toBe(false);

    act(() => result.current.bind.onPointerDown(fakeEvent({ clientX: 100, clientY: 50 })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.consumeTrailingClick()).toBe(true);
    // Only the one trailing click is swallowed, not every click after.
    expect(result.current.consumeTrailingClick()).toBe(false);
  });
});
