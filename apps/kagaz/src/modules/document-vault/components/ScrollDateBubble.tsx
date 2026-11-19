/**
 * Floating date while scrolling (device feedback 2026-11-19): as the document
 * list scrolls, a pill at the right edge — riding the scroll position like a
 * scrollbar thumb — shows when the topmost visible document was added. It
 * fades out shortly after scrolling stops. Rendered in IonContent's `fixed`
 * slot so it stays put while the list moves.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';

/** Lists shorter than this many screens scroll too little to need it. */
const MIN_SCREENS = 2;
/** How long the pill stays after the last scroll event. */
const HIDE_AFTER_MS = 900;
/** Pill height plus margin, kept out of the travel range (px). */
const PILL_SPACE = 56;

/** Props for {@link ScrollDateBubble}. */
export interface ScrollDateBubbleProps {
  /** IonContent's scroll element; null until it resolves. */
  scrollElement: HTMLElement | null;
  /** The documents being listed, to look up the date by row id. */
  documents: DocumentEntity[];
}

/** The id of the first document row whose bottom is below the viewport top. */
function topDocumentId(scroller: HTMLElement): string | null {
  const top = scroller.getBoundingClientRect().top;
  for (const row of scroller.querySelectorAll<HTMLElement>('[data-doc-id]')) {
    if (row.getBoundingClientRect().bottom > top + 1) {
      return row.dataset.docId ?? null;
    }
  }
  return null;
}

/** A date pill that follows the scroll position while the vault list scrolls. */
export function ScrollDateBubble({ scrollElement, documents }: ScrollDateBubbleProps): ReactNode {
  const { formatDateTime } = useLocale();
  const [shown, setShown] = useState<{ id: string; offset: number } | null>(null);

  useEffect(() => {
    if (!scrollElement) return undefined;
    let hideTimer = 0;
    let frame = 0;
    const update = (): void => {
      frame = 0;
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const id = topDocumentId(scrollElement);
      if (scrollHeight < clientHeight * MIN_SCREENS || !id) {
        setShown(null);
        return;
      }
      const progress = scrollTop / Math.max(1, scrollHeight - clientHeight);
      setShown({ id, offset: Math.round(progress * Math.max(0, clientHeight - PILL_SPACE)) });
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setShown(null), HIDE_AFTER_MS);
    };
    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    scrollElement.addEventListener('scroll', onScroll, { passive: true });
    return (): void => {
      scrollElement.removeEventListener('scroll', onScroll);
      window.clearTimeout(hideTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollElement]);

  const doc = shown ? documents.find((d) => d.id === shown.id) : undefined;
  return (
    <div
      slot="fixed"
      className={`kg-scroll-date${doc ? ' kg-scroll-date--shown' : ''}`}
      style={{ transform: `translateY(${shown?.offset ?? 0}px)` }}
      aria-hidden="true"
      data-agent-id="vault.home.scroll-date"
      data-agent-state={doc ? 'expanded' : 'collapsed'}
    >
      {doc ? formatDateTime(doc.createdAt) : null}
    </div>
  );
}
