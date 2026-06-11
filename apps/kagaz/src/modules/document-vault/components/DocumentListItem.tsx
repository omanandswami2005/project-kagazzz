/**
 * One document row (02-document-vault-module.md §Module File
 * Structure). Display-only in F-1 — preview/detail interactions land
 * with F-24/F-25.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Icon, type IconName } from '@kagaz/ui';
import { useLocale } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { FileType } from '../types/document.types';

const TYPE_ICONS: Partial<Record<string, IconName>> = {
  [FileType.PDF]: 'FileText',
  [FileType.JPG]: 'FileImage',
  [FileType.JPEG]: 'FileImage',
  [FileType.PNG]: 'FileImage',
  [FileType.HEIC]: 'FileImage',
  [FileType.WEBP]: 'FileImage',
};

/** Props for {@link DocumentListItem}. */
export interface DocumentListItemProps {
  document: DocumentEntity;
  /** Tap/Enter handler. Full preview lands with F-24; F-1 ships a stopgap. */
  onOpen?: (document: DocumentEntity) => void;
  /** Star-toggle handler (F-33). Star is hidden when omitted. */
  onToggleFavorite?: (document: DocumentEntity) => void;
}

/** Name, type badge, size, and created date for one vault document. */
export function DocumentListItem({
  document,
  onOpen,
  onToggleFavorite,
}: DocumentListItemProps): ReactNode {
  const { t } = useTranslation('documents');
  const { formatDate, formatFileSize } = useLocale();

  const body = (
    <>
      <span className="kg-doc-item__icon" aria-hidden="true">
        <Icon name={TYPE_ICONS[document.fileType] ?? 'File'} size={24} />
      </span>
      <span className="kg-doc-item__body">
        <span className="kg-doc-item__name">{document.name}</span>
        <span className="kg-doc-item__meta">
          <Badge size="sm" variant="info">
            {document.fileType.toUpperCase()}
          </Badge>
          <span aria-label={t('detail.size')}>
            {formatFileSize(document.fileSize)}
          </span>
          <span aria-label={t('detail.created')}>
            {formatDate(document.createdAt)}
          </span>
        </span>
      </span>
    </>
  );

  const agentId = `vault.home.item-${document.id}`;

  // A real <button> when openable (native focus + Enter/Space); a plain
  // row otherwise. Full preview/detail lands with F-24/F-25.
  return (
    <li className="kg-doc-item__li">
      {onOpen ? (
        <button
          type="button"
          className="kg-doc-item kg-doc-item--button"
          data-agent-id={agentId}
          data-agent-state="idle"
          onClick={() => onOpen(document)}
        >
          {body}
        </button>
      ) : (
        <div
          className="kg-doc-item"
          data-agent-id={agentId}
          data-agent-state="idle"
        >
          {body}
        </div>
      )}
      {onToggleFavorite && (
        <button
          type="button"
          className="kg-doc-item__star"
          data-agent-id={`vault.home.item-${document.id}.favorite`}
          data-agent-action="vault.toggleFavorite"
          data-agent-state={document.isFavorite ? 'selected' : 'idle'}
          aria-pressed={document.isFavorite}
          aria-label={t(document.isFavorite ? 'actions.unfavorite' : 'actions.favorite')}
          onClick={() => onToggleFavorite(document)}
        >
          <Icon
            name="Star"
            size={20}
            color={
              document.isFavorite ? 'var(--color-warning)' : 'var(--text-muted)'
            }
          />
        </button>
      )}
    </li>
  );
}
