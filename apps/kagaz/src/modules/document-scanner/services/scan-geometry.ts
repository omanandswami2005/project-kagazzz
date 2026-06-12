/**
 * Pure scan geometry (F-2) — no OpenCV, no DOM, fully unit-tested.
 * Turns four unordered corner points into a canonical clockwise quad,
 * sizes the de-skewed output, and validates that a detection is a
 * plausible document (convex and large enough).
 */
import type { Point, Quad } from '../types/scanner.types';

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Orders four arbitrary points into top-left, top-right, bottom-right,
 * bottom-left. Uses the classic sum/difference trick: the top-left has
 * the smallest x+y and the bottom-right the largest; the top-right has
 * the smallest y−x and the bottom-left the largest. Robust to rotation
 * and input order.
 */
export function orderCorners(points: readonly Point[]): Quad {
  if (points.length !== 4) {
    throw new Error(`orderCorners expects 4 points, got ${points.length}`);
  }
  const bySum = (p: Point): number => p.x + p.y;
  const byDiff = (p: Point): number => p.y - p.x;

  let topLeft = points[0];
  let bottomRight = points[0];
  let topRight = points[0];
  let bottomLeft = points[0];
  for (const p of points) {
    if (bySum(p) < bySum(topLeft)) topLeft = p;
    if (bySum(p) > bySum(bottomRight)) bottomRight = p;
    if (byDiff(p) < byDiff(topRight)) topRight = p;
    if (byDiff(p) > byDiff(bottomLeft)) bottomLeft = p;
  }
  return { topLeft, topRight, bottomRight, bottomLeft };
}

/**
 * Output size of the corrected page: the longer of each pair of opposite
 * edges (top/bottom for width, left/right for height), so no content is
 * squashed. Always integer and ≥ 1.
 */
export function quadOutputSize(quad: Quad): { width: number; height: number } {
  const widthTop = distance(quad.topLeft, quad.topRight);
  const widthBottom = distance(quad.bottomLeft, quad.bottomRight);
  const heightLeft = distance(quad.topLeft, quad.bottomLeft);
  const heightRight = distance(quad.topRight, quad.bottomRight);
  return {
    width: Math.max(1, Math.round(Math.max(widthTop, widthBottom))),
    height: Math.max(1, Math.round(Math.max(heightLeft, heightRight))),
  };
}

/** Signed area of the quad (shoelace), clockwise → negative in screen space. */
function signedArea(quad: Quad): number {
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Absolute area of the quad in square pixels. */
export function quadArea(quad: Quad): number {
  return Math.abs(signedArea(quad));
}

/**
 * True when the quad is a plausible document: a non-degenerate convex
 * quadrilateral covering at least `minAreaRatio` of `imageArea` (when an
 * image area is supplied). Concave or near-collinear detections are
 * rejected so the warp never produces a folded page.
 */
export function isValidQuad(
  quad: Quad,
  imageArea?: number,
  minAreaRatio = 0.1
): boolean {
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];

  // Convexity: every consecutive edge must turn the same way (non-zero).
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const c = pts[(i + 2) % pts.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) {
      return false; // collinear corner → degenerate
    }
    const thisSign = Math.sign(cross);
    if (sign === 0) {
      sign = thisSign;
    } else if (thisSign !== sign) {
      return false; // concave
    }
  }

  if (imageArea !== undefined && imageArea > 0) {
    if (quadArea(quad) / imageArea < minAreaRatio) {
      return false;
    }
  }
  return true;
}
