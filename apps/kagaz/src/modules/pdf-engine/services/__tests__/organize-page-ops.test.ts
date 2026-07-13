import { describe, expect, it } from 'vitest';
import {
  movePage,
  removePage,
  rotatePage,
  toPageOps,
  type OrganizePage,
} from '../organize-page-ops';

/** Three pristine pages a → b → c. */
function pages(): OrganizePage[] {
  return [
    { key: 'a', sourceIndex: 0, rotation: 0 },
    { key: 'b', sourceIndex: 1, rotation: 0 },
    { key: 'c', sourceIndex: 2, rotation: 0 },
  ];
}

describe('organize-page-ops (F-35)', () => {
  describe('rotatePage', () => {
    it('cycles a page 0 → 90 → 180 → 270 → 0', () => {
      let list = pages();
      const angles = [90, 180, 270, 0];
      for (const expected of angles) {
        list = rotatePage(list, 'b');
        expect(list.find((p) => p.key === 'b')?.rotation).toBe(expected);
      }
      // Other pages are untouched.
      expect(list.find((p) => p.key === 'a')?.rotation).toBe(0);
    });
  });

  describe('removePage', () => {
    it('removes the named page', () => {
      expect(removePage(pages(), 'b').map((p) => p.key)).toEqual(['a', 'c']);
    });

    it('never removes the last remaining page', () => {
      const one: OrganizePage[] = [{ key: 'a', sourceIndex: 0, rotation: 0 }];
      expect(removePage(one, 'a')).toEqual(one);
    });
  });

  describe('movePage', () => {
    it('moves a page earlier', () => {
      expect(movePage(pages(), 'b', -1).map((p) => p.key)).toEqual(['b', 'a', 'c']);
    });

    it('moves a page later', () => {
      expect(movePage(pages(), 'b', 1).map((p) => p.key)).toEqual(['a', 'c', 'b']);
    });

    it('is a no-op at the boundaries', () => {
      expect(movePage(pages(), 'a', -1).map((p) => p.key)).toEqual(['a', 'b', 'c']);
      expect(movePage(pages(), 'c', 1).map((p) => p.key)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('toPageOps', () => {
    it('projects to the engine PageOp contract in order', () => {
      const reordered = movePage(rotatePage(pages(), 'a'), 'c', -1);
      expect(toPageOps(reordered)).toEqual([
        { sourceIndex: 0, rotation: 90 },
        { sourceIndex: 2, rotation: 0 },
        { sourceIndex: 1, rotation: 0 },
      ]);
    });
  });
});
