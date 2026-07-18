/**
 * One document row (02-document-vault-module.md §Module File
 * Structure). Display-only in F-1 — preview/detail interactions land
 * with F-24/F-25.
 */
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, Tag, type IconName } from '@kagaz/ui';
import { useLocale } from '@/core/i18n';
import type {
  DocumentEntity,
  TagEntity,
} from '@/infrastructure/database/types';
import { useThumbnail } from '../hooks/useThumbnail';
import { FileType } from '../types/document.types';

const TYPE_ICONS: Partial<Record<string, IconName>> = {
  [FileType.PDF]: 'FileText',
  [FileType.JPG]: 'FileImage',
  [FileType.JPEG]: 'FileImage',
  [FileType.PNG]: 'FileImage',
  [FileType.HEIC]: 'FileImage',
  [FileType.WEBP]: 'FileImage',
};

/** Short, human type label for the meta line — MIME or extension → e.g. "PDF". */
function shortType(fileType: string): string {
  const sub = fileType.includes('/') ? fileType.split('/')[1] : fileType;
  return sub.replace('jpeg', 'jpg').toUpperCase();
}

/** Props for {@link DocumentListItem}. */
export interface DocumentListItemProps {
  document: DocumentEntity;
  /** Tap/Enter handler. Full preview lands with F-24; F-1 ships a stopgap. */
  onOpen?: (document: DocumentEntity) => void;
  /** Star-toggle handler (F-33). Star is hidden when omitted. */
  onToggleFavorite?: (document: DocumentEntity) => void;
  /** Tags assigned to this document (F-10), shown as chips. */
  tags?: TagEntity[];
  /** Opens the overflow menu (tags F-10, move F-9). Hidden when omitted. */
  onMore?: (document: DocumentEntity) => void;
  /** Multi-select mode active (F-25): tapping selects instead of opening. */
  selectionMode?: boolean;
  /** Whether this row is selected (F-25). */
  selected?: boolean;
  /** Toggles this row's selection (F-25). */
  onToggleSelect?: (document: DocumentEntity) => void;
  /**
   * Long-press (500ms) enters selection mode (F-25) — interaction-patterns.md
   * "Long-press (500ms)" row. Ignored while `selectionMode` is already true;
   * the item-menu's "Select" action is the keyboard/screen-reader equivalent.
   */
  onLongPress?: (document: DocumentEntity) => void;
}

/** interaction-patterns.md "Long-press (500ms)" — enter selection mode on lists. */
const LONG_PRESS_MS = 500;

/**
 * Finger-drift tolerance before a hold is treated as a scroll instead of a
 * long-press. Real touchscreens can't hold perfectly still — without this,
 * ordinary hand tremor during the 500ms hold gets misread by the browser as
 * the start of a scroll gesture, which fires `pointercancel` and silently
 * drops the long-press — the "sometimes it just doesn't select" symptom.
 */
const MOVE_CANCEL_THRESHOLD_PX = 12;

/** Name, type badge, size, and created date for one vault document. */
export function DocumentListItem({
  document,
  onOpen,
  onToggleFavorite,
  tags = [],
  onMore,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onLongPress,
}: DocumentListItemProps): ReactNode {
  const { t } = useTranslation('documents');
  const { formatDate, formatFileSize } = useLocale();
  const thumbnailUrl = useThumbnail(document.thumbnailPath);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(
    null
  );

  const clearLongPressTimer = (): void => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // A row can unmount mid-press (the list re-sorts/re-filters, a background
  // refresh swaps in a new documents array, etc.) without ever getting a
  // pointerup/cancel on this instance. Without this cleanup the timer keeps
  // running in the background and fires later on a stale `document` closure
  // — a phantom selection-mode entry with no visible press behind it, which
  // reads as "long-press got stuck" since the UI state changes with no
  // corresponding gesture.
  useEffect(() => clearLongPressTimer, []);

  const releaseCapture = (event: PointerEvent<HTMLElement>): void => {
    // Some WebView versions throw releasing a pointer that was never
    // captured (e.g. this handler firing for a plain tap); never let that
    // escape and interrupt the rest of the touch/click sequence.
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Best-effort only.
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (!onLongPress || selectionMode || event.pointerType === 'mouse') return;
    longPressFired.current = false;
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
    // Keep move/up/cancel routed to this element for the held pointer even
    // if the finger drifts a little — without capture, drift can hand the
    // gesture to the scroll container mid-hold, which is what makes
    // long-press feel inconsistent on a real touchscreen (a mouse/emulator
    // press has none of this jitter, so it never surfaces there).
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Best-effort only — the timer/threshold logic below still works
      // without capture, just with less drift tolerance.
    }
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      longPressTimer.current = null;
      onLongPress(document);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_THRESHOLD_PX) {
      clearLongPressTimer();
    }
  };

  const handlePointerUpOrCancel = (event: PointerEvent<HTMLElement>): void => {
    clearLongPressTimer();
    pointerStart.current = null;
    releaseCapture(event);
  };

  const body = (
    <>
      {selectionMode && (
        <span className="kg-doc-item__check" aria-hidden="true">
          <Icon
            name={selected ? 'Check' : 'File'}
            size={20}
            color={selected ? 'var(--color-primary)' : 'var(--text-muted)'}
          />
        </span>
      )}
      <span className="kg-doc-item__icon" aria-hidden="true">
        {document.isLocked ? (
          // [SEC] locked docs (§3.1): blur any thumbnail + overlay a lock.
          <span
            className="kg-doc-item__locked"
            data-agent-id={`vault.home.item-${document.id}.locked`}
          >
            {thumbnailUrl && (
              <img
                className="kg-doc-item__thumb kg-doc-item__thumb--locked"
                src={thumbnailUrl}
                alt=""
                loading="lazy"
              />
            )}
            <Icon name="Lock" size={20} />
          </span>
        ) : thumbnailUrl ? (
          <img
            className="kg-doc-item__thumb"
            src={thumbnailUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <Icon name={TYPE_ICONS[document.fileType] ?? 'File'} size={24} />
        )}
      </span>
      <span className="kg-doc-item__body">
        <span className="kg-doc-item__name">{document.name}</span>
        {/* UX-5: one muted metadata line — type · size · date — no badge chrome,
           so the document name is the only strong element in the row. */}
        <span className="kg-doc-item__meta">
          {shortType(document.fileType)}
          <span className="kg-doc-item__dot" aria-hidden>
            ·
          </span>
          {formatFileSize(document.fileSize)}
          <span className="kg-doc-item__dot" aria-hidden>
            ·
          </span>
          {formatDate(document.createdAt)}
        </span>
        {tags.length > 0 && (
          <span className="kg-doc-item__tags">
            {/* UX-2: at most 2 chips on one line; the rest collapse to "+N". */}
            {tags.slice(0, 2).map((tag) => (
              <Tag key={tag.id} label={tag.name} color={tag.color ?? undefined} />
            ))}
            {tags.length > 2 && (
              <span className="kg-doc-item__tag-more">+{tags.length - 2}</span>
            )}
          </span>
        )}
      </span>
    </>
  );

  const agentId = `vault.home.item-${document.id}`;

  // In selection mode the whole row toggles selection; otherwise it opens.
  const rowClick = selectionMode
    ? onToggleSelect
      ? (): void => onToggleSelect(document)
      : undefined
    : onOpen
      ? (): void => onOpen(document)
      : undefined;
  const rowState = selectionMode && selected ? 'selected' : 'idle';

  // Long-press already entered selection mode — swallow the trailing click
  // (pointerup fires a click right after) so it doesn't also toggle a row.
  const handleClick = (): void => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    rowClick?.();
  };

  // A real <button> when interactive (native focus + Enter/Space); a plain
  // row otherwise. Full preview/detail lands with F-24.
  return (
    <li className="kg-doc-item__li">
      {rowClick ? (
        <button
          type="button"
          className="kg-doc-item kg-doc-item--button"
          data-agent-id={agentId}
          data-agent-state={rowState}
          aria-pressed={selectionMode ? selected : undefined}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
        >
          {body}
        </button>
      ) : (
        <div
          className="kg-doc-item"
          data-agent-id={agentId}
          data-agent-state={rowState}
        >
          {body}
        </div>
      )}
      {!selectionMode && (onToggleFavorite || onMore) && (
        <span className="kg-doc-item__actions">
          {onMore && (
            <button
              type="button"
              className="kg-doc-item__action"
              data-agent-id={`vault.home.item-${document.id}.more`}
              data-agent-state="idle"
              aria-label={t('actions.more')}
              onClick={() => onMore(document)}
            >
              <Icon name="MoreVertical" size={20} color="var(--text-muted)" />
            </button>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              className="kg-doc-item__action"
              data-agent-id={`vault.home.item-${document.id}.favorite`}
              data-agent-action="vault.toggleFavorite"
              data-agent-state={document.isFavorite ? 'selected' : 'idle'}
              aria-pressed={document.isFavorite}
              aria-label={t(
                document.isFavorite ? 'actions.unfavorite' : 'actions.favorite'
              )}
              onClick={() => onToggleFavorite(document)}
            >
              <Icon
                name="Star"
                size={20}
                color={
                  document.isFavorite
                    ? 'var(--color-warning)'
                    : 'var(--text-muted)'
                }
              />
            </button>
          )}
        </span>
      )}
    </li>
  );
}
