/**
 * Trash / Recycle Bin page (F-57). Lists soft-deleted documents so the user can
 * restore them or delete them for good; items are auto-purged after
 * {@link TRASH_RETENTION_DAYS} days (also enforced at app launch).
 *
 * [SEC]/[LEGAL] The destructive actions (delete-forever, empty-trash) carry a
 * `data-agent-id` for testing but no Action Registry entry, so the AI assistant
 * cannot permanently destroy documents.
 */
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Spinner } from '@kagaz/ui';
import { useLocale } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useTrash } from '../hooks/useTrash';
import { TRASH_RETENTION_DAYS } from '../services/trash.service';
import './trash.css';

/** The Trash / Recycle Bin screen. */
export function TrashPage(): ReactNode {
  const { t } = useTranslation('documents');
  const { locale } = useLocale();
  const trash = useTrash();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const formatDate = (iso?: string): string =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)) : '';

  return (
    <IonPage data-agent-id="vault.trash">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" data-agent-id="vault.trash.back" />
          </IonButtons>
          <IonTitle>{t('trash.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="kg-trash" data-agent-id="vault.trash.content">
          <p className="kg-trash__note">{t('trash.retention_note', { days: TRASH_RETENTION_DAYS })}</p>

          {trash.loading ? (
            <div className="kg-trash__loading">
              <Spinner size="lg" label={t('trash.title')} />
            </div>
          ) : trash.items.length === 0 ? (
            <div className="kg-trash__empty" data-agent-id="vault.trash.empty">
              <Icon name="Trash2" size={48} aria-hidden />
              <p>{t('trash.empty_state')}</p>
            </div>
          ) : (
            <>
              <div className="kg-trash__toolbar">
                {confirmEmpty ? (
                  <div className="kg-trash__confirm" role="group">
                    <span>{t('trash.empty_confirm')}</span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setConfirmEmpty(false);
                        void trash.emptyTrash();
                      }}
                      agentId="vault.trash.empty-confirm"
                    >
                      {t('trash.empty_confirm_yes')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmEmpty(false)}
                      agentId="vault.trash.empty-cancel"
                    >
                      {t('trash.cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmEmpty(true)}
                    agentId="vault.trash.empty"
                  >
                    {t('trash.empty_trash')}
                  </Button>
                )}
              </div>

              <ul className="kg-trash__list" data-agent-id="vault.trash.list">
                {trash.items.map((doc: DocumentEntity) => (
                  <li key={doc.id} className="kg-trash__item" data-agent-id={`vault.trash.item.${doc.id}`}>
                    <div className="kg-trash__meta">
                      <span className="kg-trash__name">{doc.name}</span>
                      <span className="kg-trash__deleted">
                        {t('trash.deleted_on', { date: formatDate(doc.deletedAt) })}
                      </span>
                    </div>
                    <div className="kg-trash__actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void trash.restore(doc)}
                        agentId={`vault.trash.restore.${doc.id}`}
                      >
                        {t('trash.restore')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void trash.deleteForever(doc)}
                        agentId={`vault.trash.delete.${doc.id}`}
                      >
                        {t('trash.delete_forever')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
}

export default TrashPage;
