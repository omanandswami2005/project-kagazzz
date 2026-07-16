/**
 * Quick "Copy text" for a vault document (F-68). Copies the document's stored
 * OCR/extracted text (`DocumentEntity.ocrText`) to the system clipboard without
 * opening the viewer — handy for scanned docs and screenshots.
 *
 * Documents whose text layer has never been extracted have no `ocrText`; for
 * those the viewer's on-demand extraction (UX-13 / F-40) is the path. Callers
 * gate the menu item on {@link documentHasCopyableText}.
 *
 * [SEC] The text is document content — copied straight to the clipboard, never
 * logged.
 */
import { useCallback } from 'react';
import { copyToClipboard } from '@/core/clipboard';
import type { DocumentEntity } from '@/infrastructure/database/types';

/** True when the document has stored text that "Copy text" can copy. */
export function documentHasCopyableText(document: DocumentEntity): boolean {
  return Boolean(document.ocrText && document.ocrText.trim().length > 0);
}

/** What {@link useCopyDocumentText} exposes. */
export interface UseCopyDocumentText {
  /** Copy the document's stored text. Resolves false if there is none or the copy fails. */
  copy: (document: DocumentEntity) => Promise<boolean>;
  /** Whether a given document has text worth offering to copy. */
  hasText: (document: DocumentEntity) => boolean;
}

/** Wires the clipboard helper into a document "Copy text" action. */
export function useCopyDocumentText(): UseCopyDocumentText {
  const copy = useCallback(async (document: DocumentEntity): Promise<boolean> => {
    const text = document.ocrText?.trim();
    if (!text) {
      return false;
    }
    return copyToClipboard(text);
  }, []);

  return { copy, hasText: documentHasCopyableText };
}
