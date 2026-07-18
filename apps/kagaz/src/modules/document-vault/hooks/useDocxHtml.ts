/**
 * Loads a stored Word (.docx) document and converts it to sanitised HTML for
 * the viewer (F-43). No-op (returns null html) for non-.docx documents.
 */
import { useEffect, useState } from 'react';
import { log } from '@/core/logging';
import { createFileStorage } from '@/infrastructure/filesystem';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { convertDocxToHtml } from '../services/docx-viewer';

const logger = log('document-vault');

/** True when the document is a Word .docx (by extension). */
export function isDocx(fileType: string): boolean {
  return fileType.toLowerCase() === 'docx';
}

/** What {@link useDocxHtml} exposes. */
export interface UseDocxHtml {
  /** Sanitised HTML, or null (not a .docx, still loading, or failed). */
  html: string | null;
  loading: boolean;
  error: boolean;
}

/** Renders a .docx document to sanitised HTML for the viewer. */
export function useDocxHtml(document: DocumentEntity | null): UseDocxHtml {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!document || !isDocx(document.fileType)) {
      return;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const bytes = await createFileStorage().read(document.filePath);
        const out = await convertDocxToHtml(bytes);
        if (!cancelled) {
          setHtml(out);
          setLoading(false);
        }
      } catch (err) {
        logger.warn({ event: 'vault.viewer.docx_error', err: { message: String(err) } });
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    return (): void => {
      cancelled = true;
    };
  }, [document]);

  return { html, loading, error };
}
