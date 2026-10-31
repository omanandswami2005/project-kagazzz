/**
 * Document text extraction (F-20/ADR-019 + UX-13). Pulls searchable text out of
 * a document and stores it in the encrypted `documents.ocr_text` column, which
 * the FTS index already searches — so the text becomes findable (and, later,
 * usable by on-device AI).
 *   - images → on-device ML Kit OCR (native only);
 *   - PDFs → pdfjs `getTextContent` PER PAGE (fast, OCR-free, UX-13); any page
 *     whose native text is too sparse to be real content (a scanned page, or
 *     a scanned page with just a stamped page-number/watermark on top — see
 *     MIN_CONFIDENT_PAGE_TEXT_CHARS) is rendered and OCR'd instead, page by
 *     page, so a stamp elsewhere in the document can't hide missing OCR on
 *     the pages that actually need it.
 *
 * [SEC] The extracted text is sensitive: it is written only to the encrypted
 * DB and never logged (only its length is). **Bug-audit fix**: this used to
 * read a locked document's raw file bytes and run OCR on it with no
 * biometric check — gated here so the vault list's item-menu can't bypass
 * the per-document lock (§3.1) for this content-exposing action either.
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
  extractPdfTextPerPageImpl,
  pdfToImagesImpl,
} from '@/modules/pdf-engine/services/pdf-render-ops';
import { getConfiguredVisionRecognizer } from '@/modules/image-engine/services/vision-ocr.service';
import { ocrPdfPages } from '../services/pdf-ocr';
import { mimeTypeFor } from '../services/upload.service';
import { isPdf } from './useDocumentFile';
import { useDocLock } from './useDocLock';

const logger = log('document-vault');

/**
 * Below this many non-whitespace characters, a page's native text layer is
 * treated as "not real content" — a stamped page number ("3") or a short
 * watermark ("CONFIDENTIAL"), not the page's actual text — and OCR'd instead
 * (F-20 follow-up, 2026-07-21: a scanned PDF with page numbers stamped on
 * every page previously extracted as just those page numbers, because the
 * whole-document text was non-empty even though no page had real content).
 * A heuristic, not a certainty — deliberately conservative (a real page this
 * short is rare) so it errs toward re-OCRing rather than trusting a stamp.
 */
const MIN_CONFIDENT_PAGE_TEXT_CHARS = 20;

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

/** Opt-in vision-model fallback (Gemma via Ollama) for platforms without ML Kit; null when off. */
const visionRecognizer = getConfiguredVisionRecognizer();

/** True when some OCR engine is available: native ML Kit, else the vision fallback. */
function hasOcrEngine(): boolean {
  return isOcrSupported() || visionRecognizer !== null;
}

/** Whether OCR can run on this document (an engine is available + image type). */
export function canOcr(document: DocumentEntity): boolean {
  return hasOcrEngine() && isOcrableType(document.fileType);
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
  const { authorizeView } = useDocLock();
  const [runningId, setRunningId] = useState<string | null>(null);

  const extractText = useCallback(
    async (document: DocumentEntity): Promise<string | null> => {
      if (!db || !canExtractText(document)) {
        return null;
      }
      if (!(await authorizeView(document))) {
        return null;
      }
      setRunningId(document.id);
      try {
        const lang = locale === 'hi' ? 'hi' : 'en';
        let text: string;
        let source: 'pdf-layer' | 'pdf-mixed' | 'ocr' = 'ocr';
        if (isPdf(document.fileType)) {
          // UX-13: read the embedded text layer first (fast, no OCR) — but
          // per PAGE, not the whole document (see MIN_CONFIDENT_PAGE_TEXT_CHARS
          // above for why a whole-document check isn't enough).
          const bytes = await createFileStorage().read(document.filePath);
          const pageTexts = await extractPdfTextPerPageImpl(bytes);
          const sparsePages = pageTexts
            .map((pageText, i) => ({ i, chars: pageText.replace(/\s/g, '').length }))
            .filter(({ chars }) => chars < MIN_CONFIDENT_PAGE_TEXT_CHARS)
            .map(({ i }) => i);
          // Scanned pages (whole doc, or just some pages) have no real text
          // layer — OCR exactly those pages (native only; no-op on web).
          if (sparsePages.length > 0 && hasOcrEngine()) {
            const renderPages = (pdf: Uint8Array, pages?: number[]): Promise<Blob[]> =>
              pdfToImagesImpl(pdf, { format: 'png', scale: 2, pages });
            const ocrTexts = await ocrPdfPages(
              bytes,
              sparsePages,
              lang,
              isOcrSupported() || !visionRecognizer
                ? { renderPages, recognize: recognizeDocumentText, storage: createFileStorage() }
                : { renderPages, recognizeImage: visionRecognizer }
            );
            sparsePages.forEach((pageIndex, k) => {
              // Keep the native (if any) text when OCR itself found nothing —
              // a stamped page number beats an empty string.
              pageTexts[pageIndex] = ocrTexts[k] || pageTexts[pageIndex];
            });
          }
          text = pageTexts.filter((p) => p.length > 0).join('\n\n').trim();
          source =
            sparsePages.length === 0
              ? 'pdf-layer'
              : sparsePages.length === pageTexts.length
                ? 'ocr'
                : 'pdf-mixed';
        } else {
          // Images go straight through native ML Kit OCR.
          text =
            isOcrSupported() || !visionRecognizer
              ? await recognizeDocumentText(document.filePath, lang)
              : await visionRecognizer(
                  new Blob([(await createFileStorage().read(document.filePath)) as BlobPart], {
                    type: mimeTypeFor(document.fileType),
                  })
                );
        }
        await new DocumentDao(db).update(document.id, { ocrText: text });
        logger.info({
          event: 'vault.text.stored',
          documentId: document.id,
          source,
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
    [db, locale, authorizeView]
  );

  return { runningId, extractText };
}
