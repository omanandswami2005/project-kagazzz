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

/** Fetches one document by id. */
export function useDocument(id: string): UseDocument {
  const { db } = useDatabase();
  const [document, setDocument] = useState<DocumentEntity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      return;
    }
    let cancelled = false;
    // No synchronous setState here (loading starts true; the viewer loads one
    // id for its lifetime). The async load flips it when done.
    void new DocumentDao(db).findById(id).then((doc) => {
      if (!cancelled) {
        setDocument(doc);
        setLoading(false);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [db, id]);

  return { document, loading };
}
