/**
 * Image filters / enhancement (F-29): applies one of the `FILTER_PRESETS`
 * (grayscale, black & white, auto-enhance, invert) via the Canvas-based
 * `image-engine` service and saves the result as a new document — same
 * gate (`canConvertImageFormat` reused) and non-destructive save pattern as
 * F-8's format conversion. Brightness/contrast are parameterized filters the
 * engine already supports but aren't offered here yet (they need a slider
 * UI, not an action-sheet pick — a follow-up, not this pass).
 */
import { useCallback, useState } from 'react';
import { log } from '@/core/logging';
import { createFileStorage } from '@/infrastructure/filesystem';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { applyImageFilter } from '@/modules/image-engine/services/image-engine.service';
import { FILTER_PRESETS, type FilterPreset } from '@/modules/image-engine/services/image-filters';
import { mimeTypeFor } from '../services/upload.service';
import { canConvertImageFormat } from './useImageFormatConversion';
import { useUpload } from './useUpload';

const logger = log('document-vault');

/** Whether a filter preset can be applied to `document` — same Canvas-decodable gate as F-8. */
export const canApplyImageFilter = canConvertImageFormat;

/**
 * Builds `<name>_<suffix>.<extension>` for a filtered copy. `document.name`
 * is the stored DB value, which never carries an extension (the upload
 * pipeline strips it into `fileType` at save time — see `upload.service.ts`
 * `splitFileName`), so the extension always comes from `fileType`, not from
 * parsing `name`. Getting this wrong once produced a filename with no
 * extension at all, which the upload pipeline's own validation then
 * rejected as `INVALID_FILE_TYPE`.
 */
function withSuffix(document: DocumentEntity, suffix: string): string {
  const base = document.name.replace(/\.[^/.]+$/, '');
  return `${base}_${suffix}.${document.fileType}`;
}

/** What {@link useImageEnhancement} exposes. */
export interface UseImageEnhancement {
  /** Id of the document currently being filtered, or null. */
  runningId: string | null;
  /** Applies `preset` to `document` and saves it as a new document. */
  applyFilter: (document: DocumentEntity, preset: FilterPreset) => Promise<boolean>;
}

/** Applies an image filter preset (F-29) and saves the result. */
export function useImageEnhancement(): UseImageEnhancement {
  const { ingestFiles } = useUpload();
  const [runningId, setRunningId] = useState<string | null>(null);

  const applyFilter = useCallback(
    async (document: DocumentEntity, preset: FilterPreset): Promise<boolean> => {
      setRunningId(document.id);
      try {
        const bytes = await createFileStorage().read(document.filePath);
        const mime = mimeTypeFor(document.fileType);
        const sourceBlob = new Blob([bytes as BlobPart], { type: mime });
        const filtered = await applyImageFilter(sourceBlob, FILTER_PRESETS[preset], { mime });
        const name = withSuffix(document, preset);
        const { uploaded } = await ingestFiles([
          { name, blob: filtered, source: 'ai_generated' },
        ]);
        if (uploaded > 0) {
          logger.info({
            event: 'vault.image.filter.success',
            documentId: document.id,
            preset,
          });
        } else {
          logger.warn({
            event: 'vault.image.filter.failed',
            documentId: document.id,
            reason: 'save rejected the filtered file',
          });
        }
        return uploaded > 0;
      } catch (error) {
        logger.warn({
          event: 'vault.image.filter.failed',
          documentId: document.id,
          err: { message: String(error) },
        });
        return false;
      } finally {
        setRunningId(null);
      }
    },
    [ingestFiles]
  );

  return { runningId, applyFilter };
}
