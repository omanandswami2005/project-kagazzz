/**
 * Recent documents strip (02-document-vault-module.md §Favorites &
 * Recently Accessed): a horizontal row of the last-opened documents shown
 * above the full list (F-32). Hidden when nothing was opened yet.
 * Collapsible (UX pass, 2026-07-23) — same accordion pattern as everywhere
 * else in the app that shows/hides a whole section.
 *
 * Redesigned (UX-16, user-requested "large preview" + "beautiful drag
 * animation"): larger cards, native scroll-snap carousel with a
 * coverflow-lite scale/opacity effect ({@link useCoverflowScroll}) driven
 * by the row's own scroll position, and a swipe-up gesture on each card
 * that opens PDF Tools ({@link useSwipeUp}) — the "swipe action on screen
 * opens Tools" request, kept on the vertical axis specifically so it never
 * competes with the horizontal carousel drag for the same pointer input.
 *
 * [SEC] Locked documents (§3.1) get the same blurred-thumbnail + lock-icon
 * treatment as `DocumentListItem` — this row reads straight off
 * `DocumentDao.findRecent()`, which (deliberately, like the main list)
 * does not filter `is_locked`, so it must not render an unblurred preview
 * of a document the user locked.
 */
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@kagaz/ui';
import { usePreferencesStore } from '@/core/preferences';
import { hapticTap } from '@/core/haptics';
import { useSwipeUp } from '@/core/gestures';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useThumbnail } from '../hooks/useThumbnail';
import { useCoverflowScroll } from '../hooks/useCoverflowScroll';
import { FileType } from '../types/document.types';

const TYPE_ICONS: Partial<Record<string, IconName>> = {
  [FileType.PDF]: 'FileText',
  [FileType.JPG]: 'FileImage',
  [FileType.JPEG]: 'FileImage',
  [FileType.PNG]: 'FileImage',
  [FileType.HEIC]: 'FileImage',
  [FileType.WEBP]: 'FileImage',
};

/** Caps how far a card visually lifts while dragging, past the commit point. */
const MAX_LIFT_PX = 28;

/** Default when the caller doesn't wire the Tools shortcut. */
const noopOpenTools = (): void => undefined;

/** One recent card: real thumbnail when available, type icon otherwise. */
function RecentItem({
  document,
  onOpen,
  onOpenTools,
  disabled,
}: {
  document: DocumentEntity;
  onOpen: (document: DocumentEntity) => void;
  onOpenTools: () => void;
  /** Multi-select mode is active on the main list (F-25) — the strip above
   * it must not stay independently interactive while that's happening. */
  disabled: boolean;
}): ReactNode {
  const thumbnailUrl = useThumbnail(document.thumbnailPath);
  const { dragY, isDragging, bind } = useSwipeUp({
    onSwipeUp: onOpenTools,
    onThresholdCross: () => hapticTap(),
    disabled,
  });
  const lift = Math.max(-MAX_LIFT_PX, dragY);

  return (
    <li className="kg-recent__li">
      <button
        type="button"
        className="kg-recent__item"
        data-agent-id={`vault.home.recent-${document.id}`}
        data-agent-state="idle"
        disabled={disabled}
        onClick={() => onOpen(document)}
        style={{
          transform: dragY !== 0 ? `translateY(${lift}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        {...bind}
      >
        {document.isLocked ? (
          // [SEC] §3.1: same blurred-thumbnail + lock-icon treatment as
          // DocumentListItem — findRecent() doesn't filter is_locked.
          <span className="kg-recent__locked" data-agent-id={`vault.home.recent-${document.id}.locked`}>
            {thumbnailUrl && (
              <img
                className="kg-recent__thumb kg-recent__thumb--locked"
                src={thumbnailUrl}
                alt=""
                loading="lazy"
              />
            )}
            <Icon name="Lock" size={24} />
          </span>
        ) : thumbnailUrl ? (
          <img className="kg-recent__thumb" src={thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <Icon name={TYPE_ICONS[document.fileType] ?? 'File'} size={48} />
        )}
        <span className="kg-recent__name">{document.name}</span>
      </button>
    </li>
  );
}

/** Props for {@link RecentStrip}. */
export interface RecentStripProps {
  documents: DocumentEntity[];
  onOpen: (document: DocumentEntity) => void;
  /** Navigates to PDF Tools — fired by a swipe-up on any card. Optional so
   * existing callers/tests that don't care about the Tools shortcut don't
   * need to wire it. */
  onOpenTools?: () => void;
  /** Multi-select mode is active on the main list below (F-25) — disables
   * every card's tap/swipe so the strip doesn't stay independently
   * interactive while the user is mid-selection. Defaults to false so
   * existing callers/tests that don't pass it are unaffected. */
  selectionMode?: boolean;
}

/** Horizontal quick-access carousel of recently opened documents. */
export function RecentStrip({
  documents,
  onOpen,
  onOpenTools,
  selectionMode = false,
}: RecentStripProps): ReactNode {
  const { t } = useTranslation('documents');
  const collapsed = usePreferencesStore((s) => s.recentSectionCollapsed);
  const setCollapsed = usePreferencesStore((s) => s.setRecentSectionCollapsed);
  const rowRef = useRef<HTMLUListElement>(null);
  useCoverflowScroll(rowRef, [documents.length, collapsed]);

  if (documents.length === 0) {
    return null;
  }
  return (
    <section className="kg-recent" data-agent-id="vault.home.recent">
      <button
        type="button"
        className="kg-recent__header"
        aria-expanded={!collapsed}
        aria-controls="vault-home-recent-row"
        data-agent-id="vault.home.recent-toggle"
        data-agent-state={collapsed ? 'collapsed' : 'expanded'}
        onClick={() => setCollapsed(!collapsed)}
      >
        <h2 className="kg-recent__title">{t('recent.title')}</h2>
        <Icon
          name="ChevronDown"
          size={20}
          color="var(--text-secondary)"
          aria-label={t(collapsed ? 'recent.expand' : 'recent.collapse')}
        />
      </button>
      {!collapsed && (
        <ul id="vault-home-recent-row" className="kg-recent__row" ref={rowRef}>
          {documents.map((document) => (
            <RecentItem
              key={document.id}
              document={document}
              onOpen={onOpen}
              onOpenTools={onOpenTools ?? noopOpenTools}
              disabled={selectionMode}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
