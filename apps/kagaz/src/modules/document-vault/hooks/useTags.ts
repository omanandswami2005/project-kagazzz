/**
 * Tag data hook (F-10): all tags, per-document assignments, and the
 * create/assign/remove mutations. Backed by TagDao; refreshes its own
 * snapshot after each mutation so chips and the selector stay in sync.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { TagDao } from '@/infrastructure/database/dao';
import type { TagEntity } from '@/infrastructure/database/types';

const logger = log('document-vault');

/** What {@link useTags} exposes. */
export interface UseTagsResult {
  /** All tags, alphabetical. */
  tags: TagEntity[];
  /** documentId → its tags (for inline chips). */
  tagsByDocument: Map<string, TagEntity[]>;
  /** Creates a tag and returns it (or null if the DB is unavailable). */
  createTag: (name: string, color?: string) => Promise<TagEntity | null>;
  /** Attaches a tag to a document. */
  assignTag: (documentId: string, tagId: string) => Promise<void>;
  /** Detaches a tag from a document. */
  removeTag: (documentId: string, tagId: string) => Promise<void>;
}

function groupByDocument(
  assignments: { documentId: string; tag: TagEntity }[]
): Map<string, TagEntity[]> {
  const map = new Map<string, TagEntity[]>();
  for (const { documentId, tag } of assignments) {
    const list = map.get(documentId) ?? [];
    list.push(tag);
    map.set(documentId, list);
  }
  return map;
}

/** Loads tags + assignments and exposes tag mutations. */
export function useTags(): UseTagsResult {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new TagDao(db) : null), [db]);
  const [tags, setTags] = useState<TagEntity[]>([]);
  const [tagsByDocument, setTagsByDocument] = useState<Map<string, TagEntity[]>>(
    new Map()
  );

  const refresh = useCallback(async (): Promise<void> => {
    if (!dao) {
      return;
    }
    try {
      const [all, assignments] = await Promise.all([
        dao.findAll(),
        dao.findAllAssignments(),
      ]);
      setTags(all);
      setTagsByDocument(groupByDocument(assignments));
    } catch (error) {
      logger.error({
        event: 'vault.tags.load.failed',
        err: { message: String(error) },
      });
    }
  }, [dao]);

  // Initial load is inlined (not via refresh) so the async boundary is
  // visible to the react-hooks lint and setState never runs synchronously.
  useEffect(() => {
    if (!dao) {
      return;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const [all, assignments] = await Promise.all([
          dao.findAll(),
          dao.findAllAssignments(),
        ]);
        if (!cancelled) {
          setTags(all);
          setTagsByDocument(groupByDocument(assignments));
        }
      } catch (error) {
        logger.error({
          event: 'vault.tags.load.failed',
          err: { message: String(error) },
        });
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [dao]);

  const createTag = useCallback(
    async (name: string, color?: string): Promise<TagEntity | null> => {
      if (!dao) {
        return null;
      }
      const tag = await dao.create(name.trim(), color);
      logger.info({ event: 'vault.tags.create', tagId: tag.id });
      await refresh();
      return tag;
    },
    [dao, refresh]
  );

  const assignTag = useCallback(
    async (documentId: string, tagId: string): Promise<void> => {
      if (!dao) {
        return;
      }
      await dao.attach(documentId, tagId);
      await refresh();
    },
    [dao, refresh]
  );

  const removeTag = useCallback(
    async (documentId: string, tagId: string): Promise<void> => {
      if (!dao) {
        return;
      }
      await dao.detach(documentId, tagId);
      await refresh();
    },
    [dao, refresh]
  );

  return { tags, tagsByDocument, createTag, assignTag, removeTag };
}
