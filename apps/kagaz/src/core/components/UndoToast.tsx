/**
 * Reusable undo toast (F-88 generalization of the pattern VaultHomePage
 * introduced for single-document soft-delete, UX-1). Any destructive-but-
 * reversible action — a swipe-delete, a bulk delete — can show one of
 * these instead of re-declaring the same `IonToast` shape at each call
 * site. 4s: long enough to react, short enough not to block the next
 * action (within the app's existing 3-5s toast-duration range).
 */
import { IonToast } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

/** How long an undo toast stays open before auto-dismissing. */
export const UNDO_TOAST_DURATION_MS = 4000;

/** Props for {@link UndoToast}. */
export interface UndoToastProps {
  isOpen: boolean;
  message: string;
  onUndo: () => void;
  onDidDismiss: () => void;
  agentId: string;
}

/** A dismissible toast offering one Undo action. */
export function UndoToast({
  isOpen,
  message,
  onUndo,
  onDidDismiss,
  agentId,
}: UndoToastProps): ReactNode {
  const { t } = useTranslation('documents');
  return (
    <IonToast
      isOpen={isOpen}
      duration={UNDO_TOAST_DURATION_MS}
      message={message}
      buttons={[{ text: t('trash.undo'), handler: onUndo }]}
      onDidDismiss={onDidDismiss}
      data-agent-id={agentId}
    />
  );
}
