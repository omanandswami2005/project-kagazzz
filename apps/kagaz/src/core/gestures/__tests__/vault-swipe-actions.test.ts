import { describe, expect, it } from 'vitest';
import { SWIPE_ACTION_META, swipeReveal } from '../vault-swipe-actions';

describe('swipeReveal', () => {
  it('returns null for "none"', () => {
    expect(swipeReveal('none')).toBeNull();
  });

  it('resolves every non-none kind to its meta entry', () => {
    for (const kind of ['delete', 'favorite', 'move', 'tags'] as const) {
      expect(swipeReveal(kind)).toBe(SWIPE_ACTION_META[kind]);
    }
  });
});
