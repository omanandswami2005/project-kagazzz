/**
 * Format detection from magic bytes (04-image-engine-module.md §5.3).
 * Extensions lie; the binary header doesn't. Pure and synchronous over a
 * header byte slice so it is fully unit-testable, plus a blob wrapper.
 */
import type { ImageFormat } from '../types/image.types';

/** Bytes of the header we need to recognise every supported format. */
const HEADER_BYTES = 16;

/** True when `bytes` starts with `sig` at `offset`. */
function matchesAt(
  bytes: Uint8Array,
  offset: number,
  sig: readonly number[]
): boolean {
  if (bytes.length < offset + sig.length) {
    return false;
  }
  return sig.every((byte, i) => bytes[offset + i] === byte);
}

/**
 * Recognises an image format from its leading bytes, or null if none
 * match. Pass at least {@link HEADER_BYTES} bytes for reliable results.
 */
export function detectFormatFromBytes(bytes: Uint8Array): ImageFormat | null {
  // JPEG: FF D8 FF
  if (matchesAt(bytes, 0, [0xff, 0xd8, 0xff])) {
    return 'jpeg';
  }
  // PNG: 89 50 4E 47
  if (matchesAt(bytes, 0, [0x89, 0x50, 0x4e, 0x47])) {
    return 'png';
  }
  // WebP: 'RIFF' .... 'WEBP'
  if (
    matchesAt(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    matchesAt(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return 'webp';
  }
  // GIF: 'GIF8'
  if (matchesAt(bytes, 0, [0x47, 0x49, 0x46, 0x38])) {
    return 'gif';
  }
  // BMP: 'BM'
  if (matchesAt(bytes, 0, [0x42, 0x4d])) {
    return 'bmp';
  }
  // TIFF: 'II*\0' (little-endian) or 'MM\0*' (big-endian)
  if (
    matchesAt(bytes, 0, [0x49, 0x49, 0x2a, 0x00]) ||
    matchesAt(bytes, 0, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return 'tiff';
  }
  // HEIC/HEIF: 'ftyp' box at offset 4, with a heif-family brand.
  if (matchesAt(bytes, 4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (['heic', 'heix', 'heif', 'mif1', 'msf1'].includes(brand)) {
      return 'heic';
    }
  }
  return null;
}

/** Reads the header of a blob and detects its image format. */
export async function detectFormat(blob: Blob): Promise<ImageFormat | null> {
  const header = await blob.slice(0, HEADER_BYTES).arrayBuffer();
  return detectFormatFromBytes(new Uint8Array(header));
}
