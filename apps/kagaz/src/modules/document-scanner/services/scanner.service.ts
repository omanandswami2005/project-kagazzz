/**
 * Scanner orchestration (F-2). Ties the pure geometry to a pluggable
 * {@link ScannerEngine} — the thing that actually runs OpenCV.js/jscanify
 * edge detection and the perspective warp (ADR-016, lands with the camera
 * UI). Keeping the engine behind an interface means this flow is unit-
 * tested with a fake and the WASM stays out of jsdom.
 */
import type { Point, Quad, ScanOptions, ScanResult } from '../types/scanner.types';
import { isValidQuad, orderCorners, quadOutputSize } from './scan-geometry';

/** Default JPEG quality for the corrected page. */
export const DEFAULT_SCAN_QUALITY = 0.92;

/**
 * A source-bound engine: created for one image/frame, it can locate the
 * document corners in that frame and warp a quad out of it. The OpenCV.js
 * implementation arrives with the scanner UI; tests pass a fake.
 */
export interface ScannerEngine {
  /** Area (width × height) of the bound frame, in pixels². */
  readonly imageArea: number;
  /** Detect the document's four corners, or null if none are found. */
  detectCorners(): Promise<Point[] | null>;
  /** Perspective-correct `quad` to a flat `width`×`height` JPEG. */
  warp(
    quad: Quad,
    width: number,
    height: number,
    quality: number
  ): Promise<Blob>;
}

/**
 * Auto-scan: detect the document, validate it covers enough of the frame,
 * and de-skew it. Returns null when no plausible document is found (the UI
 * then falls back to manual corner placement).
 */
export async function scanDocument(
  engine: ScannerEngine,
  opts: ScanOptions = {}
): Promise<ScanResult | null> {
  const raw = await engine.detectCorners();
  if (!raw || raw.length !== 4) {
    return null;
  }
  const corners = orderCorners(raw);
  if (!isValidQuad(corners, engine.imageArea, opts.minAreaRatio)) {
    return null;
  }
  return correctToPage(engine, corners, opts);
}

/**
 * Warps an explicit set of corners — used after the user drags the corner
 * handles in the review screen (02 §Document Scanning Flow). Points may be
 * in any order; they are normalised first.
 */
export async function applyCorners(
  engine: ScannerEngine,
  rawCorners: readonly Point[],
  opts: ScanOptions = {}
): Promise<ScanResult> {
  return correctToPage(engine, orderCorners(rawCorners), opts);
}

/** Shared tail: size the page from the quad and warp it. */
async function correctToPage(
  engine: ScannerEngine,
  corners: Quad,
  opts: ScanOptions
): Promise<ScanResult> {
  const { width, height } = quadOutputSize(corners);
  const image = await engine.warp(
    corners,
    width,
    height,
    opts.quality ?? DEFAULT_SCAN_QUALITY
  );
  return { image, width, height, corners };
}
