/**
 * New-folder prompt (02-document-vault-module.md §Folder Organization):
 * an alert with a single name field; confirming creates a folder in the
 * current folder (F-9).
 */
import { Alert } from '@kagaz/ui';
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
    <Alert
      isOpen={isOpen}
      header={t('folders.new')}
      agentId="vault.home.new-folder-dialog"
      onDidDismiss={onDismiss}
      input={{
        label: t('folders.name_placeholder'),
        placeholder: t('folders.name_placeholder'),
      }}
      buttons={[
        { text: t('actions.cancel'), role: 'cancel' },
        {
          text: t('folders.create'),
          handler: (name?: string): void => {
            const trimmed = (name ?? '').trim();
            if (trimmed) {
              onCreate(trimmed);
            }
          },
        },
      ]}
    />
  );
}
