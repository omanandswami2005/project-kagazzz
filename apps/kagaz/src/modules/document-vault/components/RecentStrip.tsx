/**
 * Recent documents strip (02-document-vault-module.md §Favorites &
 * Recently Accessed): a horizontal row of the last-opened documents
 * shown above the full list (F-32). Hidden when nothing was opened yet.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
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

/** One recent card: real thumbnail when available, type icon otherwise. */
function RecentItem({
  document,
  onOpen,
}: {
  document: DocumentEntity;
  onOpen: (document: DocumentEntity) => void;
}): ReactNode {
  const thumbnailUrl = useThumbnail(document.thumbnailPath);
  return (
    <li className="kg-recent__li">
      <button
        type="button"
        className="kg-recent__item"
        data-agent-id={`vault.home.recent-${document.id}`}
        data-agent-state="idle"
        onClick={() => onOpen(document)}
      >
        {thumbnailUrl ? (
          <img className="kg-recent__thumb" src={thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <Icon name={TYPE_ICONS[document.fileType] ?? 'File'} size={32} />
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
}

/** Horizontal quick-access row of recently opened documents. */
export function RecentStrip({
  documents,
  onOpen,
}: RecentStripProps): ReactNode {
  const { t } = useTranslation('documents');
  if (documents.length === 0) {
    return null;
  }
  return (
    <section className="kg-recent" data-agent-id="vault.home.recent">
      <h2 className="kg-recent__title">{t('recent.title')}</h2>
      <ul className="kg-recent__row">
        {documents.map((document) => (
          <RecentItem key={document.id} document={document} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}
