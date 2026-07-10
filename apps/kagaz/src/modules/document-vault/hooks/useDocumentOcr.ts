/**
 * Document OCR (F-20, ADR-019). Runs on-device text recognition over an image
 * document and stores the result in the encrypted `documents.ocr_text` column,
 * which the FTS index already searches — so OCR'd text becomes findable.
 *
 * [SEC] The recognized text is sensitive: it is written only to the encrypted
 * DB and never logged (only its length is).
 */
import { useCallback, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { useLocale } from '@/core/i18n';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import {
  isOcrSupported,
  recognizeDocumentText,
} from '@/modules/image-engine/services/ocr.service';

const logger = log('document-vault');

/** Image MIME types OCR can read (ML Kit takes a bitmap). */
const OCR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Whether OCR can run on this document (native platform + image type). */
export function canOcr(document: DocumentEntity): boolean {
  return isOcrSupported() && OCR_TYPES.includes(document.fileType);
}

/** What {@link useDocumentOcr} exposes. */
export interface UseDocumentOcr {
  /** Id of the document currently being OCR'd, or null. */
  runningId: string | null;
  /** Extracts text from an image document and stores it; returns the text. */
  extractText: (document: DocumentEntity) => Promise<string | null>;
}

/** Runs OCR on image documents and persists the text for search. */
export function useDocumentOcr(): UseDocumentOcr {
  const { db } = useDatabase();
  const { locale } = useLocale();
  const [runningId, setRunningId] = useState<string | null>(null);

  const extractText = useCallback(
    async (document: DocumentEntity): Promise<string | null> => {
      if (!db || !canOcr(document)) {
        return null;
      }
      setRunningId(document.id);
      try {
        const language = locale === 'hi' ? 'hi' : 'en';
        const text = await recognizeDocumentText(document.filePath, language);
        await new DocumentDao(db).update(document.id, { ocrText: text });
        logger.info({ event: 'vault.ocr.stored', documentId: document.id, chars: text.length });
        return text;
      } catch (error) {
        logger.warn({
          event: 'vault.ocr.error',
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
