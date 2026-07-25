/**
 * Loads a single document by id for the viewer (UX-6). Returns null while
 * loading or if not found.
 */
import { useEffect, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';

/** What {@link useDocument} exposes. */
export interface UseDocument {
  document: DocumentEntity | null;
  loading: boolean;
}

/** Options for {@link useDocument}. */
export interface UseDocumentOptions {
  /**
   * Load a soft-deleted (Trash) row instead of a live one (F-57 preview
   * follow-up). `findById` never returns a trashed row (it filters
   * `deleted_at IS NULL`, matching every other "live" query), so previewing
   * from Trash needs the mirror-image `findTrashedById` — see the DAO's own
   * doc comment for why that's scoped to trashed rows only.
   */
  trashed?: boolean;
}

/** Fetches one document by id — live by default, or trashed via `options`. */
export function useDocument(id: string, options?: UseDocumentOptions): UseDocument {
  const { db } = useDatabase();
  const [document, setDocument] = useState<DocumentEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const trashed = options?.trashed ?? false;

  useEffect(() => {
    if (!db) {
      return;
    }
    let cancelled = false;
    // No synchronous setState here (loading starts true; the viewer loads one
    // id for its lifetime). The async load flips it when done.
    const dao = new DocumentDao(db);
    const load = trashed ? dao.findTrashedById(id) : dao.findById(id);
    void load.then((doc) => {
      if (!cancelled) {
        setDocument(doc);
        setLoading(false);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [db, id, trashed]);

  return { document, loading };
}
