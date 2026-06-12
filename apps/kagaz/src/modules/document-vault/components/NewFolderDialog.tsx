/**
 * New-folder prompt (02-document-vault-module.md §Folder Organization):
 * an alert with a single name field; confirming creates a folder in the
 * current folder (F-9).
 */
import { IonAlert } from '@ionic/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Props for {@link NewFolderDialog}. */
export interface NewFolderDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  /** Called with the entered name when the user confirms (non-empty). */
  onCreate: (name: string) => void;
}

/** Name-entry alert for creating a folder. */
export function NewFolderDialog({
  isOpen,
  onDismiss,
  onCreate,
}: NewFolderDialogProps): ReactNode {
  const { t } = useTranslation('documents');
  return (
    <IonAlert
      isOpen={isOpen}
      header={t('folders.new')}
      data-agent-id="vault.home.new-folder-dialog"
      onDidDismiss={onDismiss}
      inputs={[
        {
          name: 'name',
          type: 'text',
          placeholder: t('folders.name_placeholder'),
          attributes: { 'aria-label': t('folders.name_placeholder') },
        },
      ]}
      buttons={[
        { text: t('actions.cancel'), role: 'cancel' },
        {
          text: t('folders.create'),
          handler: (data: { name?: string }): void => {
            const name = (data.name ?? '').trim();
            if (name) {
              onCreate(name);
            }
          },
        },
      ]}
    />
  );
}
