/**
 * PDF Tools run history (2026-11-19). Loads the latest runs — one tool's, or
 * all of them — and resolves the stored document ids to live documents. A
 * document that was deleted (or is in Trash) resolves to `doc: null`, so its
 * name is never shown again after deletion.
 */
import { useCallback, useEffect, useState } from 'react';
import { useOptionalDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao, ToolHistoryDao } from '@/infrastructure/database/dao';
import type { DocumentEntity, ToolRunEntity } from '@/infrastructure/database/types';

const logger = log('pdf-engine');

/** How many runs a history list shows. */
export const HISTORY_LIMIT = 30;

/** A stored document reference, resolved. */
export interface HistoryDocRef {
  id: string;
  /** The live document, or null once deleted / trashed. */
  doc: DocumentEntity | null;
}

/** One run with its documents resolved. */
export interface ResolvedToolRun {
  run: ToolRunEntity;
  inputs: HistoryDocRef[];
  outputs: HistoryDocRef[];
}

/** What {@link useToolHistory} exposes. */
export interface UseToolHistoryResult {
  entries: ResolvedToolRun[];
  loading: boolean;
  /** Deletes every run (all tools). */
  clear: () => Promise<void>;
}

/**
 * @param toolId only this tool's runs; omit for the combined history.
 * @param refreshKey change it to reload (e.g. after a run finishes).
 */
export function useToolHistory(toolId?: string, refreshKey: unknown = 0): UseToolHistoryResult {
  const db = useOptionalDatabase();
  const [entries, setEntries] = useState<ResolvedToolRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!db) {
      return undefined;
    }
    let cancelled = false;
    const documents = new DocumentDao(db);
    const cache = new Map<string, Promise<DocumentEntity | null>>();
    const resolve = (id: string): Promise<HistoryDocRef> => {
      if (!cache.has(id)) cache.set(id, documents.findById(id));
      return cache.get(id)!.then((doc) => ({ id, doc }));
    };
    void (async (): Promise<void> => {
      try {
        const runs = await new ToolHistoryDao(db).findRecent(HISTORY_LIMIT, toolId);
        const resolved = await Promise.all(
          runs.map(async (run) => ({
            run,
            inputs: await Promise.all(run.inputDocumentIds.map(resolve)),
            outputs: await Promise.all(run.outputDocumentIds.map(resolve)),
          }))
        );
        if (!cancelled) setEntries(resolved);
      } catch (err: unknown) {
        logger.warn({ event: 'pdf.tool.history_load_failed', err: { message: String(err) } });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [db, toolId, refreshKey, reload]);

  const clear = useCallback(async (): Promise<void> => {
    if (!db) return;
    await new ToolHistoryDao(db).clear();
    setReload((n) => n + 1);
  }, [db]);

  return { entries, loading: db ? loading : false, clear };
}
