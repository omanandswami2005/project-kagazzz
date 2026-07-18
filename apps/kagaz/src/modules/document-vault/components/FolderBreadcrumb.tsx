/**
 * Folder breadcrumb (02-document-vault-module.md §Folder Organization):
 * the path from the vault root to the current folder, each segment
 * tappable to jump back up the tree (F-9). Hidden at the root.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import type { FolderEntity } from '@/infrastructure/database/types';

/** Props for {@link FolderBreadcrumb}. */
export interface FolderBreadcrumbProps {
  /** Folders from root to current (empty = at root). */
  path: FolderEntity[];
  /** Navigate to a depth: 0 = root, n = the nth folder in the path. */
  onNavigate: (depth: number) => void;
}

/** Tappable root → … → current folder trail. */
export function FolderBreadcrumb({
  path,
  onNavigate,
}: FolderBreadcrumbProps): ReactNode {
  const { t } = useTranslation('documents');
  if (path.length === 0) {
    return null;
  }
  return (
    <nav
      className="kg-breadcrumb"
      aria-label={t('folders.breadcrumb')}
      data-agent-id="vault.home.breadcrumb"
    >
      <button
        type="button"
        className="kg-breadcrumb__crumb"
        data-agent-id="vault.home.breadcrumb-root"
        onClick={() => onNavigate(0)}
      >
        <Icon name="Home" size={16} />
        {t('folders.root')}
      </button>
      {path.map((folder, index) => (
        <span key={folder.id} className="kg-breadcrumb__segment">
          <Icon name="ChevronRight" size={16} />
          <button
            type="button"
            className="kg-breadcrumb__crumb"
            data-agent-id={`vault.home.breadcrumb-${folder.id}`}
                aria-current={index === path.length - 1 ? 'page' : undefined}
            onClick={() => onNavigate(index + 1)}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
