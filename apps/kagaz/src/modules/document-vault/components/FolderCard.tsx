/**
 * Folder card (02-document-vault-module.md §Folder Organization): a
 * tappable folder in the vault grid that navigates into the folder (F-9).
 * The overflow button opens the folder-options sheet (rename, change
 * color, reorder, delete).
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import type { FolderEntity } from '@/infrastructure/database/types';

/** Props for {@link FolderCard}. */
export interface FolderCardProps {
  folder: FolderEntity;
  onOpen: (folder: FolderEntity) => void;
  /** Opens the folder-options sheet. Overflow button hidden when omitted. */
  onMore?: (folder: FolderEntity) => void;
}

/** Coloured folder tile that opens the folder on tap. */
export function FolderCard({ folder, onOpen, onMore }: FolderCardProps): ReactNode {
  const { t } = useTranslation('documents');

  return (
    <div className="kg-folder-card-wrap">
      <button
        type="button"
        className="kg-folder-card"
        data-agent-id={`vault.home.folder-${folder.id}`}
        data-agent-state="idle"
        onClick={() => onOpen(folder)}
      >
        <Icon
          name="Folder"
          size={32}
          color={folder.color ?? 'var(--color-primary)'}
        />
        <span className="kg-folder-card__name">{folder.name}</span>
      </button>
      {onMore && (
        <button
          type="button"
          className="kg-folder-card__more"
          data-agent-id={`vault.home.folder-${folder.id}.more`}
          data-agent-state="idle"
          aria-label={t('actions.more')}
          onClick={(e) => {
            e.stopPropagation();
            onMore(folder);
          }}
        >
          <Icon name="MoreVertical" size={20} color="var(--text-muted)" />
        </button>
      )}
    </div>
  );
}
