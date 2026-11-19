/**
 * QR-2 (anticipatory design): ID numbers found in the text of the user's own
 * documents that aren't in Quick Reference yet — "PAN found in “PAN Card”".
 * Reads text already extracted on the phone; nothing leaves it.
 *
 * [SEC] Locked documents are skipped: their text is only readable after the
 * document's own unlock, so Quick Reference must not surface it either.
 */
import { useEffect, useState } from 'react';
import { useOptionalDatabase } from '@/app/providers/DatabaseProvider';
import { detectIdNumbers, isAlreadySaved, type DetectedId } from '@/core/id-numbers';
import { log } from '@/core/logging';
import { DocumentDao } from '@/infrastructure/database/dao';

/** At most this many suggestions — a nudge, not a second list. */
const MAX_SUGGESTIONS = 3;

/** An ID found in a document. */
export interface IdSuggestion extends DetectedId {
  documentName: string;
}

/**
 * @param savedValues the values already in Quick Reference.
 * @param enabled only scan once the screen is unlocked.
 */
export function useIdSuggestions(savedValues: readonly string[], enabled: boolean): IdSuggestion[] {
  const db = useOptionalDatabase();
  const [found, setFound] = useState<IdSuggestion[]>([]);

  useEffect(() => {
    if (!db || !enabled) return undefined;
    let cancelled = false;
    void new DocumentDao(db)
      .findAll()
      .then((docs) => {
        const out: IdSuggestion[] = [];
        for (const doc of docs) {
          if (doc.isLocked || !doc.ocrText) continue;
          for (const id of detectIdNumbers(doc.ocrText)) {
            if (!out.some((o) => o.value === id.value)) out.push({ ...id, documentName: doc.name });
          }
        }
        if (!cancelled) setFound(out);
      })
      .catch((err: unknown) => {
        log('document-vault').warn({ event: 'vault.quickref.suggest_failed', err: { message: String(err) } });
      });
    return (): void => {
      cancelled = true;
    };
  }, [db, enabled]);

  return found.filter((id) => !isAlreadySaved(id, savedValues)).slice(0, MAX_SUGGESTIONS);
}
