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
import { extractPdfTextImpl } from '@/modules/pdf-engine/services/pdf-render-ops';
import { isPdf } from './useDocumentFile';

const logger = log('document-vault');

/** Image MIME types OCR can read (ML Kit takes a bitmap). */
const OCR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Whether ML Kit OCR can run on this document (native platform + image type). */
export function canOcr(document: DocumentEntity): boolean {
  return isOcrSupported() && OCR_TYPES.includes(document.fileType);
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
        // UX-13: PDFs read their embedded text layer (fast, no OCR); images go
        // through native ML Kit OCR.
        const text = isPdf(document.fileType)
          ? await extractPdfTextImpl(await createFileStorage().read(document.filePath))
          : await recognizeDocumentText(
              document.filePath,
              locale === 'hi' ? 'hi' : 'en'
            );
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
