/**
 * Image format conversion (F-8): JPEG/PNG/WebP via the Canvas-based
 * `image-engine` service. HEIC/BMP/TIFF/GIF are decode-only (ADR-016 — no
 * bundled LGPL decoder), so they aren't offered as convertible sources.
 * Reads the original file, converts it, and saves the result as a new
 * document through the same `ingestFiles` pipeline every other in-app tool
 * output uses (non-destructive — the original document is untouched).
 */
import { useCallback, useState } from 'react';
import { log } from '@/core/logging';
import { createFileStorage } from '@/infrastructure/filesystem';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { convertFormat } from '@/modules/image-engine/services/image-engine.service';
import type { CanvasFormat } from '@/modules/image-engine/types/image.types';
import { mimeTypeFor } from '../services/upload.service';
import { useUpload } from './useUpload';

const logger = log('document-vault');

/** documents.fileType (lowercased extension) → the canvas format it decodes as. */
const CONVERTIBLE_TYPES: Record<string, CanvasFormat> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

const ALL_TARGETS: CanvasFormat[] = ['jpeg', 'png', 'webp'];

/** Output file extension for a converted document's name. */
const EXTENSION_FOR: Record<CanvasFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

/** Strips a file extension. */
function baseName(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

/** Whether `document` is a canvas-decodable image conversion can target (F-8). */
export function canConvertImageFormat(document: DocumentEntity): boolean {
  return document.fileType.toLowerCase() in CONVERTIBLE_TYPES;
}

/** The formats `document` can be converted to (excludes its own current format). */
export function conversionTargetsFor(document: DocumentEntity): CanvasFormat[] {
  const current = CONVERTIBLE_TYPES[document.fileType.toLowerCase()];
  return ALL_TARGETS.filter((format) => format !== current);
}

/** What {@link useImageFormatConversion} exposes. */
export interface UseImageFormatConversion {
  /** Id of the document currently converting, or null. */
  runningId: string | null;
  /** Converts `document` to `target` and saves it as a new document. */
  convert: (document: DocumentEntity, target: CanvasFormat) => Promise<boolean>;
}

/** Converts an image document to another Canvas-native format (F-8). */
export function useImageFormatConversion(): UseImageFormatConversion {
  const { ingestFiles } = useUpload();
  const [runningId, setRunningId] = useState<string | null>(null);

  const convert = useCallback(
    async (document: DocumentEntity, target: CanvasFormat): Promise<boolean> => {
      setRunningId(document.id);
      try {
        const bytes = await createFileStorage().read(document.filePath);
        const sourceBlob = new Blob([bytes as BlobPart], {
          type: mimeTypeFor(document.fileType),
        });
        const converted = await convertFormat(sourceBlob, target);
        const name = `${baseName(document.name)}.${EXTENSION_FOR[target]}`;
        const { uploaded } = await ingestFiles([
          { name, blob: converted, source: 'ai_generated' },
        ]);
        logger.info({
          event: 'vault.image.convert.success',
          documentId: document.id,
          target,
        });
        return uploaded > 0;
      } catch (error) {
        logger.warn({
          event: 'vault.image.convert.failed',
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

  return { runningId, convert };
}
