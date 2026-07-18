/**
 * Turns a stored document into displayable page image URLs for the viewer
 * (UX-6). Images → a single object URL; PDFs → one rendered image per page via
 * the pdf-engine's proven pdfjs path (WebView only — jsdom has no canvas).
 * Object URLs are revoked on cleanup.
 */
import { useEffect, useState } from 'react';
import { log } from '@/core/logging';
import { createFileStorage } from '@/infrastructure/filesystem';
import { pdfToImagesImpl } from '@/modules/pdf-engine/services/pdf-render-ops';
import type { DocumentEntity } from '@/infrastructure/database/types';

const logger = log('document-vault');

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

/** True when the document is a PDF (MIME or extension). */
export function isPdf(fileType: string): boolean {
  return /pdf/i.test(fileType);
}

/** Raster image types the viewer can show directly. */
const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic']);

/** True when the document is a raster image the viewer can display. */
export function isViewableImage(fileType: string): boolean {
  return fileType.includes('/')
    ? fileType.startsWith('image/')
    : IMAGE_TYPES.has(fileType.toLowerCase());
}

function mimeFor(fileType: string): string {
  return fileType.includes('/') ? fileType : (EXT_MIME[fileType.toLowerCase()] ?? 'application/octet-stream');
}

/** What {@link useDocumentFile} exposes. */
export interface UseDocumentFile {
  /** One image URL per page (PDF) or a single URL (image); empty while loading. */
  pages: string[];
  loading: boolean;
  error: boolean;
}

/** Loads + renders a document's pages as displayable image URLs. */
export function useDocumentFile(document: DocumentEntity | null): UseDocumentFile {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!document) {
      return;
    }
    let cancelled = false;
    const urls: string[] = [];
    // No synchronous setState (loading starts true; the viewer renders one
    // document for its lifetime). The async render flips loading/error/pages.
    void (async (): Promise<void> => {
      try {
        const bytes = await createFileStorage().read(document.filePath);
        if (isPdf(document.fileType)) {
          const blobs = await pdfToImagesImpl(bytes, { scale: 1.5, format: 'jpeg', quality: 0.85 });
          for (const blob of blobs) {
            urls.push(URL.createObjectURL(blob));
          }
        } else if (isViewableImage(document.fileType)) {
          // Copy into this realm so the Blob is well-formed everywhere.
          const copy = new Uint8Array(bytes);
          urls.push(URL.createObjectURL(new Blob([copy], { type: mimeFor(document.fileType) })));
        }
        // Other types (.docx via mammoth, text) render through their own path;
        // leaving pages empty avoids a broken <img>.
        if (!cancelled) {
          setPages(urls);
          setLoading(false);
        }
      } catch (err) {
        logger.warn({ event: 'vault.viewer.render_error', err: { message: String(err) } });
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return (): void => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [document]);

  return { pages, loading, error };
}
