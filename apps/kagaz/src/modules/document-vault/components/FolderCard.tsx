/**
 * Folder card (02-document-vault-module.md §Folder Organization): a
 * tappable folder in the vault grid that navigates into the folder
 * (F-9). Long-press / overflow management arrives with the folder
 * context menu.
 */
import type { ReactNode } from 'react';
import { Icon } from '@kagaz/ui';
import type { FolderEntity } from '@/infrastructure/database/types';

/** Props for {@link FolderCard}. */
export interface FolderCardProps {
  folder: FolderEntity;
  onOpen: (folder: FolderEntity) => void;
}

/** Coloured folder tile that opens the folder on tap. */
export function FolderCard({ folder, onOpen }: FolderCardProps): ReactNode {
  return (
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
  );
}
