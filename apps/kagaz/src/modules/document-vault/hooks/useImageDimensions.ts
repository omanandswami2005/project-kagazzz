/**
 * Image pixel dimensions for the Details sheet (F-67), backed by F-8's
 * `getImageInfo` — exported and unit-tested since F-8 shipped but never
 * called from anywhere until now. Canvas-decodable formats only
 * (jpg/jpeg/png/webp — same gate as Convert format/Enhance photo; HEIC etc.
 * can't be decoded in-browser, see ADR-016). Returns null while loading,
 * for non-image/undecodable documents, or on read/decode failure — the
 * Details sheet simply omits the row rather than showing an error.
 */
import { useEffect, useState } from 'react';
import { log } from '@/core/logging';
import { createFileStorage } from '@/infrastructure/filesystem';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { getImageInfo } from '@/modules/image-engine/services/image-engine.service';
import { mimeTypeFor } from '../services/upload.service';
import { canConvertImageFormat } from './useImageFormatConversion';

const logger = log('document-vault');

/** A document's pixel dimensions. */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Reads `document`'s pixel dimensions, or null (loading/unsupported/failed).
 * Depends on `document`'s primitive fields, not the object reference itself
 * — a parent re-render commonly hands down a new `DocumentEntity` object for
 * the same logical document (e.g. a fresh array from a store selector), and
 * depending on the reference would re-fetch on every such render.
 *
 * The gated-out case (no document, or not Canvas-decodable) is derived on
 * return rather than reset via a synchronous `setState` inside the effect —
 * same trade-off `useThumbnail` makes: switching between two valid images
 * back-to-back may show the previous image's dimensions for one frame until
 * the new fetch resolves, but a genuinely gated-out document is always
 * correct immediately.
 */
export function useImageDimensions(
  document: DocumentEntity | null
): ImageDimensions | null {
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const documentId = document?.id;
  const filePath = document?.filePath;
  const fileType = document?.fileType;
  const isSupported =
    !!fileType && canConvertImageFormat({ fileType } as DocumentEntity);

  useEffect(() => {
    if (!documentId || !filePath || !fileType || !isSupported) {
      return undefined;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const bytes = await createFileStorage().read(filePath);
        const blob = new Blob([bytes as BlobPart], { type: mimeTypeFor(fileType) });
        const info = await getImageInfo(blob);
        if (!cancelled) {
          setDimensions({ width: info.width, height: info.height });
        }
      } catch (error) {
        if (!cancelled) {
          logger.debug({
            event: 'vault.details.dimensions.failed',
            documentId,
            err: { message: String(error) },
          });
        }
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [documentId, filePath, fileType, isSupported]);

  return isSupported ? dimensions : null;
}
