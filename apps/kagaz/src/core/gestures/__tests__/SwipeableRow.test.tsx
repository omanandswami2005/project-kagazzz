import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SwipeableRow, type SwipeReveal } from '../SwipeableRow';

const DELETE: SwipeReveal = { icon: 'Trash2', colorVar: 'var(--color-danger)' };
const FAVORITE: SwipeReveal = { icon: 'Star', colorVar: 'var(--color-warning)' };

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

describe('SwipeableRow', () => {
  it('renders children and no reveal layer while idle', () => {
    const { getByText, container } = render(
      <SwipeableRow leftReveal={DELETE} rightReveal={FAVORITE} onCommit={vi.fn()} agentId="row-1">
        <span>Row content</span>
      </SwipeableRow>
    );
    expect(getByText('Row content')).toBeInTheDocument();
    expect(container.querySelector('.kg-swipe-row__reveal')).toBeNull();
  });

  it('fires onCommit("right") on a committed rightward swipe', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <SwipeableRow leftReveal={DELETE} rightReveal={FAVORITE} onCommit={onCommit}>
        <span>Row</span>
      </SwipeableRow>
    );
    const content = container.querySelector('.kg-swipe-row__content') as Element;
    fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
    fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
    expect(onCommit).toHaveBeenCalledWith('right');
  });

  it('fires onCommit("left") on a committed leftward swipe', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <SwipeableRow leftReveal={DELETE} rightReveal={FAVORITE} onCommit={onCommit}>
        <span>Row</span>
      </SwipeableRow>
    );
    const content = container.querySelector('.kg-swipe-row__content') as Element;
    fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
    fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
    expect(onCommit).toHaveBeenCalledWith('left');
  });

  it('never commits a side with a null reveal', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <SwipeableRow leftReveal={null} rightReveal={FAVORITE} onCommit={onCommit}>
        <span>Row</span>
      </SwipeableRow>
    );
    const content = container.querySelector('.kg-swipe-row__content') as Element;
    fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
    fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('is inert while disabled (e.g. multi-select mode)', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <SwipeableRow leftReveal={DELETE} rightReveal={FAVORITE} onCommit={onCommit} disabled>
        <span>Row</span>
      </SwipeableRow>
    );
    const content = container.querySelector('.kg-swipe-row__content') as Element;
    fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
    fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(container.querySelector('.kg-swipe-row__reveal')).toBeNull();
  });
});
