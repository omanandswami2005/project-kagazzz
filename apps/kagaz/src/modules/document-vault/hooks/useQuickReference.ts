/**
 * Quick Reference / Quick Notes data hook (F-84 + UX pass 2026-07-23):
 * entries + tag assignments, and the create/update/delete/tag mutations.
 * Mirrors useTags.ts's shape exactly — backed by QuickReferenceDao,
 * refreshes its own snapshot after each mutation. `label`/`value` are
 * opaque user text; see 10-security-architecture.md §3.6.
 *
 * `isSecure` selects which board this hook instance is for: `true` is the
 * original, biometric-gated Quick Reference; `false` is Quick Notes, the
 * faster gate-free board for non-sensitive text. The two boards' entries
 * never mix — every read is filtered and every write is stamped with the
 * same fixed value a call site is instantiated with.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { QuickReferenceDao } from '@/infrastructure/database/dao';
import type {
  QuickReferenceEntry,
  TagEntity,
} from '@/infrastructure/database/types';

const logger = log('document-vault');

/** What {@link useQuickReference} exposes. */
export interface UseQuickReferenceResult {
  /** All entries, most recently updated first. */
  entries: QuickReferenceEntry[];
  /** entryId → its tags. */
  tagsByEntry: Map<string, TagEntity[]>;
  /** Loading the initial snapshot. */
  isLoading: boolean;
  /** Creates an entry and returns it (or null if the DB is unavailable). */
  createEntry: (
    label: string,
    value: string,
    linkedDocumentId?: string
  ) => Promise<QuickReferenceEntry | null>;
  /** Updates an entry's label/value. */
  updateEntry: (
    id: string,
    patch: { label?: string; value?: string }
  ) => Promise<void>;
  /** Deletes an entry. */
  deleteEntry: (id: string) => Promise<void>;
  /** Attaches a tag to an entry. */
  assignTag: (entryId: string, tagId: string) => Promise<void>;
  /** Detaches a tag from an entry. */
  removeTag: (entryId: string, tagId: string) => Promise<void>;
}

function groupByEntry(
  assignments: { entryId: string; tag: TagEntity }[]
): Map<string, TagEntity[]> {
  const map = new Map<string, TagEntity[]>();
  for (const { entryId, tag } of assignments) {
    const list = map.get(entryId) ?? [];
    list.push(tag);
    map.set(entryId, list);
  }
  return map;
}

/** Loads entries for one board (Quick Reference when `isSecure` is true,
 * Quick Notes when false) + tag assignments, and exposes mutations. */
export function useQuickReference(isSecure = true): UseQuickReferenceResult {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new QuickReferenceDao(db) : null), [db]);
  const [entries, setEntries] = useState<QuickReferenceEntry[]>([]);
  const [tagsByEntry, setTagsByEntry] = useState<Map<string, TagEntity[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    if (!dao) {
      return;
    }
    try {
      const [all, assignments] = await Promise.all([
        dao.findAll(isSecure),
        dao.findAllTagAssignments(),
      ]);
      setEntries(all);
      setTagsByEntry(groupByEntry(assignments));
    } catch (error) {
      logger.error({
        event: 'vault.quickReference.load.failed',
        err: { message: String(error) },
      });
    }
  }, [dao, isSecure]);

  // Initial load is inlined (not via refresh) so the async boundary is
  // visible to the react-hooks lint and setState never runs synchronously.
  useEffect(() => {
    if (!dao) {
      return undefined;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const [all, assignments] = await Promise.all([
          dao.findAll(isSecure),
          dao.findAllTagAssignments(),
        ]);
        if (!cancelled) {
          setEntries(all);
          setTagsByEntry(groupByEntry(assignments));
        }
      } catch (error) {
        if (!cancelled) {
          logger.error({
            event: 'vault.quickReference.load.failed',
            err: { message: String(error) },
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [dao, isSecure]);

  const createEntry = useCallback(
    async (
      label: string,
      value: string,
      linkedDocumentId?: string
    ): Promise<QuickReferenceEntry | null> => {
      if (!dao || !label.trim() || !value.trim()) {
        return null;
      }
      const entry = await dao.create(
        label.trim(),
        value.trim(),
        isSecure,
        linkedDocumentId
      );
      logger.info({ event: 'vault.quickReference.create', entryId: entry.id, isSecure });
      await refresh();
      return entry;
    },
    [dao, isSecure, refresh]
  );

  const updateEntry = useCallback(
    async (id: string, patch: { label?: string; value?: string }): Promise<void> => {
      if (!dao) {
        return;
      }
      await dao.update(id, patch);
      logger.info({ event: 'vault.quickReference.update', entryId: id });
      await refresh();
    },
    [dao, refresh]
  );

  const deleteEntry = useCallback(
    async (id: string): Promise<void> => {
      if (!dao) {
        return;
      }
      await dao.delete(id);
      logger.info({ event: 'vault.quickReference.delete', entryId: id });
      await refresh();
    },
    [dao, refresh]
  );

  const assignTag = useCallback(
    async (entryId: string, tagId: string): Promise<void> => {
      if (!dao) {
        return;
      }
      await dao.attachTag(entryId, tagId);
      await refresh();
    },
    [dao, refresh]
  );

  const removeTag = useCallback(
    async (entryId: string, tagId: string): Promise<void> => {
      if (!dao) {
        return;
      }
      await dao.detachTag(entryId, tagId);
      await refresh();
    },
    [dao, refresh]
  );

  return {
    entries,
    tagsByEntry,
    isLoading,
    createEntry,
    updateEntry,
    deleteEntry,
    assignTag,
    removeTag,
  };
}
