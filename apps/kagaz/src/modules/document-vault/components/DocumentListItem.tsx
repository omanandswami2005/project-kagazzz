/**
 * One document row (02-document-vault-module.md §Module File
 * Structure). Display-only in F-1 — preview/detail interactions land
 * with F-24/F-25.
 */
import type { ReactNode } from 'react';
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
}

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
}: DocumentListItemProps): ReactNode {
  const { t } = useTranslation('documents');
  const { formatDate, formatFileSize } = useLocale();
  const thumbnailUrl = useThumbnail(document.thumbnailPath);

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
          onClick={rowClick}
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
