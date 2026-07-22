/**
 * React wiring for the OS document intents (F-64 Open with / F-65 Share).
 * Resolves the platform availability and exposes two fire-and-forget actions
 * that swallow user-cancellation (dismissing the chooser/share sheet is not an
 * error) and report only genuine failures.
 */
import { useCallback } from 'react';
import { log } from '@/core/logging';
import type { DocumentEntity } from '@/infrastructure/database/types';
import {
  isIntentSupported,
  openDocumentWith,
  shareDocument,
  shareDocuments,
} from '../services/document-intent.service';

const logger = log('document-vault');

/** Dismissing the native chooser/share sheet rejects — treat it as a no-op. */
function isCancellation(err: unknown): boolean {
  return /cancel|dismiss|abort/i.test(String(err));
}

/** What {@link useDocumentIntents} exposes. */
export interface UseDocumentIntents {
  /** True when native intents are available (Android/iOS). */
  supported: boolean;
  /** Share via the OS share sheet. Resolves false only on a real failure. */
  share: (document: DocumentEntity) => Promise<boolean>;
  /** Share multiple documents in one share sheet (bulk-select). */
  shareMany: (documents: DocumentEntity[]) => Promise<boolean>;
  /** Open in another app via the "Open with" chooser. False only on failure. */
  openWith: (document: DocumentEntity) => Promise<boolean>;
}

/** Wires the document-intent service into React. */
export function useDocumentIntents(): UseDocumentIntents {
  const share = useCallback(async (document: DocumentEntity): Promise<boolean> => {
    try {
      await shareDocument(document);
      return true;
    } catch (err) {
      if (isCancellation(err)) {
        return true;
      }
      logger.warn({ event: 'vault.intent.share_error', err: { message: String(err) } });
      return false;
    }
  }, []);

  const shareMany = useCallback(async (documents: DocumentEntity[]): Promise<boolean> => {
    try {
      await shareDocuments(documents);
      return true;
    } catch (err) {
      if (isCancellation(err)) {
        return true;
      }
      logger.warn({
        event: 'vault.intent.share_error',
        count: documents.length,
        err: { message: String(err) },
      });
      return false;
    }
  }, []);

  const openWith = useCallback(async (document: DocumentEntity): Promise<boolean> => {
    try {
      await openDocumentWith(document);
      return true;
    } catch (err) {
      if (isCancellation(err)) {
        return true;
      }
      logger.warn({ event: 'vault.intent.open_error', err: { message: String(err) } });
      return false;
    }
  }, []);

  return { supported: isIntentSupported(), share, shareMany, openWith };
}
