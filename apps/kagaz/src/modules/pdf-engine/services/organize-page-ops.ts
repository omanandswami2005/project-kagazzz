/**
 * Pure list transforms for the F-35 page organiser. Kept free of React/canvas
 * so the reorder / rotate / delete logic is unit-testable; the sheet renders
 * these results as thumbnails.
 */
import type { PageOp, PageRotation } from '../types/pdf-engine.types';

/** One page in the organiser's working list. */
export interface OrganizePage {
  /** Stable key for React + lookups (independent of position). */
  key: string;
  /** 0-indexed page in the source PDF. */
  sourceIndex: number;
  /** Current extra clockwise rotation. */
  rotation: PageRotation;
}

const NEXT_ROTATION: Record<PageRotation, PageRotation> = {
  0: 90,
  90: 180,
  180: 270,
  270: 0,
};

// The transforms are generic over the page shape so a caller carrying extra
// fields (e.g. the sheet's thumbnail `url`) keeps its concrete type.

/** Adds a 90° clockwise turn to one page (wrapping at 360°). */
export function rotatePage<T extends OrganizePage>(pages: T[], key: string): T[] {
  return pages.map((p) =>
    p.key === key ? { ...p, rotation: NEXT_ROTATION[p.rotation] } : p
  );
}

/** Removes one page. Removing the last page is a no-op (keep ≥1). */
export function removePage<T extends OrganizePage>(pages: T[], key: string): T[] {
  if (pages.length <= 1) {
    return pages;
  }
  return pages.filter((p) => p.key !== key);
}

/**
 * Moves one page one slot toward the start (`-1`) or end (`+1`), swapping with
 * its neighbour. Out-of-bounds moves are no-ops.
 */
export function movePage<T extends OrganizePage>(
  pages: T[],
  key: string,
  direction: -1 | 1
): T[] {
  const index = pages.findIndex((p) => p.key === key);
  if (index === -1) {
    return pages;
  }
  const target = index + direction;
  if (target < 0 || target >= pages.length) {
    return pages;
  }
  const next = [...pages];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Projects the working list to the engine's {@link PageOp}[] contract. */
export function toPageOps(pages: OrganizePage[]): PageOp[] {
  return pages.map(({ sourceIndex, rotation }) => ({ sourceIndex, rotation }));
}
