import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCoverflowScroll } from '../useCoverflowScroll';

type Rect = { left: number; width: number };

/** Stubs getBoundingClientRect per-element via a left/width lookup by id. */
function stubRects(rects: Record<string, Rect>): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const rect = rects[this.id] ?? { left: 0, width: 0 };
      return {
        ...rect,
        top: 0,
        height: 56,
        right: rect.left + rect.width,
        bottom: 56,
        x: rect.left,
        y: 0,
        toJSON: () => ({}),
      };
    }
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function buildRow(): HTMLUListElement {
  const ul = document.createElement('ul');
  ul.id = 'row';
  const centered = document.createElement('li');
  centered.id = 'centered';
  const offCenter = document.createElement('li');
  offCenter.id = 'off-center';
  ul.append(centered, offCenter);
  document.body.appendChild(ul);
  return ul;
}

describe('useCoverflowScroll', () => {
  it('leaves a perfectly centered card at full scale and opacity', () => {
    const ul = buildRow();
    // Row spans 0..300 (center 150); the "centered" card is itself centered on 150.
    stubRects({
      row: { left: 0, width: 300 },
      centered: { left: 100, width: 100 },
      'off-center': { left: 0, width: 0 },
    });
    const ref = { current: ul };
    renderHook(() => useCoverflowScroll(ref, []));

    const centered = document.getElementById('centered')!;
    expect(centered.style.transform).toBe('scale(1.000)');
    // jsdom's CSSOM normalizes a whole-number opacity value's serialization.
    expect(centered.style.opacity).toBe('1');
  });

  it('shrinks and fades a card at the edge of the row', () => {
    const ul = buildRow();
    stubRects({
      row: { left: 0, width: 300 },
      centered: { left: 0, width: 0 },
      // Fully at the right edge: distance === half → distance ratio 1.
      'off-center': { left: 300, width: 0 },
    });
    const ref = { current: ul };
    renderHook(() => useCoverflowScroll(ref, []));

    const offCenter = document.getElementById('off-center')!;
    expect(offCenter.style.transform).toBe('scale(0.880)');
    // jsdom's CSSOM strips the trailing zero when serializing opacity.
    expect(offCenter.style.opacity).toBe('0.65');
  });

  it('re-applies on a scroll event', () => {
    const ul = buildRow();
    stubRects({
      row: { left: 0, width: 300 },
      centered: { left: 100, width: 100 },
      'off-center': { left: 0, width: 0 },
    });
    const ref = { current: ul };
    renderHook(() => useCoverflowScroll(ref, []));

    // Re-stub as if the row scrolled the off-center card to the center.
    stubRects({
      row: { left: 0, width: 300 },
      centered: { left: 0, width: 0 },
      'off-center': { left: 100, width: 100 },
    });
    fireEvent.scroll(ul);

    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(document.getElementById('off-center')!.style.transform).toBe(
          'scale(1.000)'
        );
        resolve();
      });
    });
  });

  it('does nothing when the container ref is not yet attached', () => {
    const ref = { current: null };
    expect(() => renderHook(() => useCoverflowScroll(ref, []))).not.toThrow();
  });
});
