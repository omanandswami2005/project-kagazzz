/**
 * Document text extraction (F-20/ADR-019 + UX-13). Pulls searchable text out of
 * a document and stores it in the encrypted `documents.ocr_text` column, which
 * the FTS index already searches — so the text becomes findable (and, later,
 * usable by on-device AI). Two paths:
 *   - images → on-device ML Kit OCR (native only);
 *   - PDFs with a text layer → pdfjs `getTextContent` (fast, OCR-free, UX-13).
 *
 * [SEC] The extracted text is sensitive: it is written only to the encrypted
 * DB and never logged (only its length is).
 */
import { useCallback, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { useLocale } from '@/core/i18n';
import { createFileStorage } from '@/infrastructure/filesystem';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import {
  isOcrSupported,
  recognizeDocumentText,
} from '@/modules/image-engine/services/ocr.service';
import {
  extractPdfTextImpl,
  pdfToImagesImpl,
} from '@/modules/pdf-engine/services/pdf-render-ops';
import { ocrScannedPdf } from '../services/pdf-ocr';
import { isPdf } from './useDocumentFile';

const logger = log('document-vault');

/**
 * Image types OCR can read (ML Kit takes a bitmap). Matched against the stored
 * `documents.fileType`, which is the lowercased **extension** (e.g. `jpg`), not
 * a MIME type — comparing it to MIME strings was the F-20 bug that stopped image
 * OCR from ever running.
 */
const OCR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/** Whether a stored fileType is an OCR-able image (pure; platform-independent). */
export function isOcrableType(fileType: string): boolean {
  return OCR_EXTENSIONS.has(fileType.toLowerCase());
}

/** Whether ML Kit OCR can run on this document (native platform + image type). */
export function canOcr(document: DocumentEntity): boolean {
  return isOcrSupported() && isOcrableType(document.fileType);
}

/**
 * Whether any text can be extracted from this document (UX-13): an image via
 * OCR, or a PDF via its text layer. PDFs work wherever pdfjs runs (no native
 * dependency), so they are not gated on the platform.
 */
export function canExtractText(document: DocumentEntity): boolean {
  return canOcr(document) || isPdf(document.fileType);
}

/** What {@link useDocumentOcr} exposes. */
export interface UseDocumentOcr {
  /** Id of the document currently being extracted, or null. */
  runningId: string | null;
  /** Extracts text (image OCR or PDF text layer), stores it, returns the text. */
  extractText: (document: DocumentEntity) => Promise<string | null>;
}

/** Extracts + persists document text (image OCR / PDF text layer) for search. */
export function useDocumentOcr(): UseDocumentOcr {
  const { db } = useDatabase();
  const { locale } = useLocale();
  const [runningId, setRunningId] = useState<string | null>(null);

  const extractText = useCallback(
    async (document: DocumentEntity): Promise<string | null> => {
      if (!db || !canExtractText(document)) {
        return null;
      }
      setRunningId(document.id);
      try {
        const lang = locale === 'hi' ? 'hi' : 'en';
        let text: string;
        if (isPdf(document.fileType)) {
          // UX-13: read the embedded text layer first (fast, no OCR).
          const bytes = await createFileStorage().read(document.filePath);
          text = await extractPdfTextImpl(bytes);
          // Scanned/image-only PDFs have no text layer — fall back to OCR of the
          // rendered pages (native only; degrades to '' on web).
          if (!text.trim() && isOcrSupported()) {
            text = await ocrScannedPdf(bytes, lang, {
              renderPages: (pdf) => pdfToImagesImpl(pdf, { format: 'png', scale: 2 }),
              recognize: recognizeDocumentText,
              storage: createFileStorage(),
            });
          }
        } else {
          // Images go straight through native ML Kit OCR.
          text = await recognizeDocumentText(document.filePath, lang);
        }
        await new DocumentDao(db).update(document.id, { ocrText: text });
        logger.info({
          event: 'vault.text.stored',
          documentId: document.id,
          source: isPdf(document.fileType) ? 'pdf-layer' : 'ocr',
          chars: text.length,
        });
        return text;
      } catch (error) {
        logger.warn({
          event: 'vault.text.error',
          documentId: document.id,
          err: { message: String(error) },
        });
        return null;
      } finally {
        setRunningId(null);
      }
    },
    [db, locale]
  );

  return { runningId, extractText };
}
