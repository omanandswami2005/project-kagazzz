/**
 * Resize & Compress for Forms (F-85): resizes an image document to exact
 * target dimensions and compresses it into a target byte budget in one
 * pass, then saves the result as a new, non-destructive document — same
 * `canConvertImageFormat` gate and `ingestFiles` save pattern as Convert
 * format (F-8) / Enhance photo (F-29).
 */
import { useCallback, useState } from 'react';
import { log } from '@/core/logging';
import { createFileStorage } from '@/infrastructure/filesystem';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { resizeAndCompress } from '@/modules/image-engine/services/resize-compress.service';
import { mimeTypeFor } from '../services/upload.service';
import { useUpload } from './useUpload';

const logger = log('document-vault');

/** Strips a file extension. */
function baseName(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

/** User-facing target: dimensions + a max-size budget (min is advisory). */
export interface ResizeCompressRequest {
  width: number;
  height: number;
  maxSizeBytes: number;
  minSizeBytes?: number;
}

/** Outcome surfaced to the UI after a run. */
export interface ResizeCompressOutcome {
  saved: boolean;
  hitQualityFloor: boolean;
  resultSizeBytes: number;
  belowMinSize: boolean;
}

/** What {@link useResizeCompress} exposes. */
export interface UseResizeCompress {
  /** Id of the document currently processing, or null. */
  runningId: string | null;
  /** Resizes+compresses `document` per `request` and saves it as a new document. */
  run: (
    document: DocumentEntity,
    request: ResizeCompressRequest
  ) => Promise<ResizeCompressOutcome>;
}

/** Resizes an image document to exact dimensions + a size budget (F-85). */
export function useResizeCompress(): UseResizeCompress {
  const { ingestFiles } = useUpload();
  const [runningId, setRunningId] = useState<string | null>(null);

  const run = useCallback(
    async (
      document: DocumentEntity,
      request: ResizeCompressRequest
    ): Promise<ResizeCompressOutcome> => {
      setRunningId(document.id);
      try {
        const bytes = await createFileStorage().read(document.filePath);
        const sourceBlob = new Blob([bytes as BlobPart], {
          type: mimeTypeFor(document.fileType),
        });
        const result = await resizeAndCompress(sourceBlob, {
          width: request.width,
          height: request.height,
          maxSizeBytes: request.maxSizeBytes,
          minSizeBytes: request.minSizeBytes,
        });
        const name = `${baseName(document.name)}_resized.jpg`;
        const { uploaded } = await ingestFiles([
          { name, blob: result.blob, source: 'ai_generated' },
        ]);
        const outcome: ResizeCompressOutcome = {
          saved: uploaded > 0,
          hitQualityFloor: result.hitQualityFloor,
          resultSizeBytes: result.blob.size,
          belowMinSize:
            request.minSizeBytes !== undefined &&
            result.blob.size < request.minSizeBytes,
        };
        if (outcome.saved) {
          logger.info({
            event: 'vault.image.resizeCompress.success',
            documentId: document.id,
            width: request.width,
            height: request.height,
            resultSizeBytes: outcome.resultSizeBytes,
            hitQualityFloor: outcome.hitQualityFloor,
          });
        } else {
          logger.warn({
            event: 'vault.image.resizeCompress.failed',
            documentId: document.id,
            reason: 'save rejected the resized file',
          });
        }
        return outcome;
      } catch (error) {
        logger.warn({
          event: 'vault.image.resizeCompress.failed',
          documentId: document.id,
          err: { message: String(error) },
        });
        return {
          saved: false,
          hitQualityFloor: false,
          resultSizeBytes: 0,
          belowMinSize: false,
        };
      } finally {
        setRunningId(null);
      }
    },
    [ingestFiles]
  );

  return { runningId, run };
}
