import { render } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
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
let lastObserver: FakeResizeObserver | null = null;
class FakeResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- test handle to fire resizes later
    lastObserver = this;
  }
  fire(width: number): void {
    this.callback([{ contentRect: { width } } as ResizeObserverEntry], this);
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

function Probe({ isGrid, mounted = true }: { isGrid: boolean; mounted?: boolean }): ReactNode {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const columns = useGridColumns(el, isGrid);
  return (
    <>
      <span data-testid="columns" data-columns={columns} />
      {mounted && <div ref={setEl} data-testid="probe" data-columns={columns} />}
    </>
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

  it('measures a container that mounts after the first render (single-column grid bug)', () => {
    observedWidth = 140 * 2 + 12;
    const { getByTestId, rerender } = render(<Probe isGrid mounted={false} />);
    expect(getByTestId('columns')).toHaveAttribute('data-columns', '1');
    rerender(<Probe isGrid />);
    expect(getByTestId('columns')).toHaveAttribute('data-columns', '2');
  });

  it('keeps its columns while the page is hidden (width 0) — B2 grid collapse', async () => {
    observedWidth = 140 * 2 + 12;
    const { getByTestId } = render(<Probe isGrid />);
    expect(getByTestId('probe')).toHaveAttribute('data-columns', '2');
    const { act } = await import('@testing-library/react');
    act(() => lastObserver?.fire(0));
    expect(getByTestId('probe')).toHaveAttribute('data-columns', '2');
  });
});
