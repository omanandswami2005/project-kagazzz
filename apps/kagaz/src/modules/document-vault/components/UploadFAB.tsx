/**
 * Upload FAB (02-document-vault-module.md §Upload Pipeline) — the
 * screen's one primary action (design-principles.md #1). Opens the
 * source options sheet.
 */
import { IonFab, IonFabButton } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useAgentProps } from '@kagaz/agent-kit';
import { Icon } from '@kagaz/ui';
import './upload-fab.css';

/** Props for {@link UploadFAB}. */
export interface UploadFABProps {
  /** Disabled until the database is ready. */
  disabled?: boolean;
  /** Opens the upload options sheet. */
  onClick: () => void;
}

/** Floating "+" button that starts the upload flow. */
export function UploadFAB({
  disabled = false,
  onClick,
}: UploadFABProps): ReactNode {
  const { t } = useTranslation('documents');
  const agentProps = useAgentProps({
    id: 'vault.home.upload-fab',
    action: 'vault.uploadDocument',
    role: 'primary-action',
    state: disabled ? 'disabled' : 'idle',
  });
  return (
    <IonFab slot="fixed" vertical="bottom" horizontal="end">
      <IonFabButton
        onClick={onClick}
        disabled={disabled}
        aria-label={t('actions.upload')}
        {...agentProps}
      >
        <Icon name="Plus" size={24} />
      </IonFabButton>
    </IonFab>
  );
}
