/**
 * Document scanner types (F-2). The scanner detects a document's four
 * corners in a camera frame, lets the user nudge them, then perspective-
 * corrects ("de-skews") the quad into a flat page. Edge detection +
 * warping run on OpenCV.js via jscanify (ADR-016); the geometry here is
 * pure and library-agnostic so it can be unit-tested without WASM.
 */

/** A pixel coordinate in image space. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The document's four corners, ordered clockwise from the top-left. This
 * canonical order is what the perspective transform maps onto a flat
 * rectangle, so every producer must normalise to it (see `orderCorners`).
 */
export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/** Outcome of a scan: the de-skewed page plus the corners used. */
export interface ScanResult {
  /** Perspective-corrected page as a JPEG blob. */
  image: Blob;
  /** Output pixel size of the corrected page. */
  width: number;
  height: number;
  /** The (ordered) corners the correction was based on. */
  corners: Quad;
}

/** Tuning knobs for a scan. */
export interface ScanOptions {
  /**
   * Minimum share of the frame the detected quad must cover to be trusted
   * (0–1). Smaller detections are treated as "no document found". Default 0.1.
   */
  minAreaRatio?: number;
  /** JPEG quality for the corrected output (0–1). Default 0.92. */
  quality?: number;
}
