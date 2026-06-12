/**
 * Move-to-folder picker (02-document-vault-module.md §Folder
 * Organization): choose a destination folder (or the root) for a
 * document (F-9). Lists every folder flat; nesting is shown via the
 * stored name only for now.
 */
import { IonModal } from '@ionic/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FolderDao } from '@/infrastructure/database/dao';
import type { FolderEntity } from '@/infrastructure/database/types';

/** Props for {@link MoveToFolderDialog}. */
export interface MoveToFolderDialogProps {
  /** Document to move; null closes the dialog. */
  documentId: string | null;
  onDismiss: () => void;
  /** Called with the chosen folder id (null = root). */
  onMove: (documentId: string, folderId: string | null) => void;
}

/** Bottom sheet listing folders to move a document into. */
export function MoveToFolderDialog({
  documentId,
  onDismiss,
  onMove,
}: MoveToFolderDialogProps): ReactNode {
  const { t } = useTranslation('documents');
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new FolderDao(db) : null), [db]);
  const [folders, setFolders] = useState<FolderEntity[]>([]);

  useEffect(() => {
    if (!dao || documentId === null) {
      return;
    }
    let cancelled = false;
    void dao.findAll().then((all) => {
      if (!cancelled) {
        setFolders(all);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [dao, documentId]);

  const choose = (folderId: string | null): void => {
    if (documentId !== null) {
      onMove(documentId, folderId);
    }
  };

  return (
    <IonModal
      isOpen={documentId !== null}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.5}
      breakpoints={[0, 0.5, 0.9]}
      data-agent-id="vault.home.move-sheet"
      data-agent-state={documentId !== null ? 'expanded' : 'collapsed'}
      aria-label={t('folders.move_title')}
    >
      <div className="kg-move-sheet">
        <h2 className="kg-move-sheet__title">{t('folders.move_title')}</h2>
        <ul className="kg-move-sheet__list" data-agent-id="vault.home.move-list">
          <li>
            <button
              type="button"
              className="kg-move-sheet__item"
              data-agent-id="vault.home.move-root"
              data-agent-action="vault.moveDocument"
              onClick={() => choose(null)}
            >
              <Icon name="Home" size={20} />
              {t('folders.root')}
            </button>
          </li>
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                className="kg-move-sheet__item"
                data-agent-id={`vault.home.move-${folder.id}`}
                data-agent-action="vault.moveDocument"
                onClick={() => choose(folder.id)}
              >
                <Icon
                  name="Folder"
                  size={20}
                  color={folder.color ?? 'var(--color-primary)'}
                />
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </IonModal>
  );
}
