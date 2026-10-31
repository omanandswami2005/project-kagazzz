import { useEffect, useMemo, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';

const logger = log('ai-assistant');

/**
 * The vault documents a user may attach to a chat message. Locked documents
 * are left out (and counted, so the sheet can say so): the assistant's tools
 * refuse them anyway, and attaching one must never bypass the biometric
 * prompt [SEC] (10-security-architecture.md §3.1).
 */
export function useAttachableDocuments(isOpen: boolean): {
  documents: DocumentEntity[];
  lockedCount: number;
} {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);
  const [all, setAll] = useState<DocumentEntity[]>([]);

  // Re-read each time the sheet opens so a just-uploaded document shows up.
  useEffect(() => {
    if (!isOpen || !dao) {
      return;
    }
    let cancelled = false;
    dao
      .findAll()
      .then((rows) => {
        if (!cancelled) {
          setAll(rows);
        }
      })
      .catch((error: unknown) => {
        logger.warn({ event: 'ai.chat.attachable_failed', err: { message: String(error) } });
      });
    return (): void => {
      cancelled = true;
    };
  }, [isOpen, dao]);

  return {
    documents: all.filter((d) => !d.isLocked),
    lockedCount: all.filter((d) => d.isLocked).length,
  };
}
