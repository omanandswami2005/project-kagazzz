/**
 * Document scanner (F-2, ADR-018). Wraps Google ML Kit's Document Scanner
 * (`@capacitor-mlkit/document-scanner`) — a fully native, Play-Services-hosted
 * scan flow (auto edge detection, perspective correction, filters, ML page
 * cleanup, multi-page → JPEG/PDF). We never build a camera or corner-review UI;
 * the plugin returns finished page URIs which the vault imports.
 *
 * Android-only. The app declares no `INTERNET`/`CAMERA` permission — Play
 * Services hosts the UI and downloads the model out-of-process on first use
 * (10-security §3.5). Callers gate on {@link isScanningSupported}.
 */
import { DocumentScanner } from '@capacitor-mlkit/document-scanner';
import { Capacitor } from '@capacitor/core';
import { log } from '@/core/logging';

const logger = log('document-scanner');

/** Max pages a single scan session may capture. */
export const SCAN_PAGE_LIMIT = 10;

/** A completed scan: finished page images plus an optional combined PDF. */
export interface ScannedDocument {
  /** File URIs of the scanned JPEG pages (device paths). */
  imageUris: string[];
  /** URI of the combined multi-page PDF, when the plugin produced one. */
  pdfUri?: string;
  /** Number of scanned pages. */
  pageCount: number;
}

/** True when native document scanning is available (Android + Play Services). */
export function isScanningSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** True when an error is the user backing out of the scanner (not a failure). */
function isCancellation(error: unknown): boolean {
  return /cancel/i.test(error instanceof Error ? error.message : String(error));
}

/**
 * Launches the native scan flow. Resolves to the scanned pages, or `null` when
 * the user cancels or the platform is unsupported. Play Services downloads the
 * scanner model on first use (one-time), so the first call may pause briefly.
 */
export async function scanDocument(pageLimit = SCAN_PAGE_LIMIT): Promise<ScannedDocument | null> {
  if (!isScanningSupported()) {
    return null;
  }
  try {
    const result = await DocumentScanner.scanDocument({
      // JPEG for single pages, PDF for multi-page (the caller picks per count).
      resultFormats: 'JPEG_PDF',
      scannerMode: 'FULL',
      pageLimit,
      galleryImportAllowed: false,
    });
    const imageUris = result.scannedImages ?? [];
    if (imageUris.length === 0) {
      return null;
    }
    logger.info({ event: 'scanner.scan.success', pages: imageUris.length });
    return {
      imageUris,
      pdfUri: result.pdf?.uri,
      pageCount: result.pdf?.pageCount ?? imageUris.length,
    };
  } catch (error) {
    if (isCancellation(error)) {
      logger.debug({ event: 'scanner.scan.cancelled' });
      return null;
    }
    logger.warn({ event: 'scanner.scan.error', err: { message: String(error) } });
    throw error;
  }
}
