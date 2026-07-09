/**
 * "Delete all data" confirmation (SEC-V1 §8 #12). Irreversible, so it gates on
 * typing the exact keyword before the destructive button arms. On confirm it
 * runs {@link createDataEraser} which wipes everything and reloads the app.
 *
 * [SEC] User-only: the confirm button carries NO `agentAction`, so the AI/voice
 * layer can never erase the vault (destructive-op boundary, §5.3).
 */
import { IonModal } from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@kagaz/ui';
import { createDataEraser } from '../services/data-erasure.service';
import './delete-data.css';

/** Props for {@link DeleteDataConfirm}. */
export interface DeleteDataConfirmProps {
  onCancel: () => void;
  /** Invoked only after the keyword is typed and the button pressed. */
  onConfirm: () => void;
}

/**
 * The type-to-confirm content (no modal chrome), split out so it can be unit-
 * tested without Ionic's modal framework delegate.
 */
export function DeleteDataConfirm({
  onCancel,
  onConfirm,
}: DeleteDataConfirmProps): ReactNode {
  const { t } = useTranslation('settings');
  const [confirmText, setConfirmText] = useState('');
  const keyword = t('data.confirm_keyword');
  const armed = confirmText.trim().toUpperCase() === keyword.toUpperCase();

  return (
    <div className="kg-erase">
      <h2 className="kg-erase__title">{t('data.confirm_title')}</h2>
      <p className="kg-erase__body">{t('data.confirm_body')}</p>
      <Input
        label={t('data.confirm_prompt', { keyword })}
        value={confirmText}
        onChange={setConfirmText}
        agentId="settings.erase-confirm-input"
      />
      <div className="kg-erase__actions">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={onCancel}
          agentId="settings.erase-cancel"
        >
          {t('data.cancel')}
        </Button>
        <Button
          variant="danger"
          size="lg"
          fullWidth
          disabled={!armed}
          onClick={() => armed && onConfirm()}
          agentId="settings.erase-confirm"
        >
          {t('data.confirm_button')}
        </Button>
      </div>
    </div>
  );
}

/** Props for {@link DeleteAllDataDialog}. */
export interface DeleteAllDataDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
}

/** Sheet-wrapped erasure confirmation. */
export function DeleteAllDataDialog({
  isOpen,
  onDismiss,
}: DeleteAllDataDialogProps): ReactNode {
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.6}
      breakpoints={[0, 0.6]}
      data-agent-id="settings.erase-dialog"
      data-agent-state={isOpen ? 'open' : 'closed'}
    >
      <DeleteDataConfirm
        onCancel={onDismiss}
        onConfirm={() => void createDataEraser()()}
      />
    </IonModal>
  );
}
