import { render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { columnsForWidth, useGridColumns } from '../useGridColumns';

describe('columnsForWidth (repeat(auto-fill, minmax(140px, 1fr)) formula)', () => {
  it('fits exactly 1 column at the minimum card width', () => {
    expect(columnsForWidth(140)).toBe(1);
  });

  it('fits exactly 3 columns for 3 cards + 2 gaps', () => {
    expect(columnsForWidth(140 * 3 + 12 * 2)).toBe(3);
  });

  it('does not fit a 4th column one pixel short', () => {
    expect(columnsForWidth(140 * 4 + 12 * 3 - 1)).toBe(3);
  });

  it('never returns fewer than 1 for a very narrow width', () => {
    expect(columnsForWidth(10)).toBe(1);
    expect(columnsForWidth(0)).toBe(1);
  });
});

// jsdom has no ResizeObserver — stub one that fires synchronously with a
// fixed contentRect so the hook's effect can be exercised against a real
// (if zero-sized) rendered element.
let observedWidth = 0;
class FakeResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element): void {
    this.callback(
      [{ target, contentRect: { width: observedWidth } } as ResizeObserverEntry],
      this
    );
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ isGrid }: { isGrid: boolean }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const columns = useGridColumns(ref, isGrid);
  return (
    <div ref={ref} data-testid="probe" data-columns={columns}>
      {columns}
    </div>
  );
}

describe('useGridColumns (hook wiring)', () => {
  it('is always 1 column when not in grid mode, regardless of width', () => {
    observedWidth = 1000;
    const { getByTestId } = render(<Probe isGrid={false} />);
    expect(getByTestId('probe')).toHaveAttribute('data-columns', '1');
  });

  it('reflects the ResizeObserver-reported width once mounted in grid mode', () => {
    observedWidth = 140 * 3 + 12 * 2;
    const { getByTestId } = render(<Probe isGrid />);
    expect(getByTestId('probe')).toHaveAttribute('data-columns', '3');
  });
});
