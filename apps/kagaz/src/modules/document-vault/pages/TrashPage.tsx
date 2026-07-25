/**
 * Trash / Recycle Bin page (F-57). Lists soft-deleted documents so the user can
 * restore them or delete them for good; items are auto-purged after
 * {@link TRASH_RETENTION_DAYS} days (also enforced at app launch).
 *
 * [SEC]/[LEGAL] The destructive actions (delete-forever, empty-trash) carry a
 * `data-agent-id` for testing but no Action Registry entry, so the AI assistant
 * cannot permanently destroy documents.
 *
 * Preview (F-57 device-testing follow-up): tapping a row's name/date opens it
 * read-only in DocumentViewerPage via `/doc/:id?trashed=1`, so the user can
 * see a trashed document's content before deciding to restore or delete it
 * for good — without restoring it first. [SEC] That route enforces the same
 * per-document lock gate for a trashed document as it does for a live one
 * (see DocumentViewerPage's own [SEC] doc comment) — this page does nothing
 * to weaken it, it's just a plain navigate.
 */
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Spinner } from '@kagaz/ui';
import { useLocale } from '@/core/i18n';
import { SwipeableRow, type SwipeReveal } from '@/core/gestures';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useTrash } from '../hooks/useTrash';
import { TRASH_RETENTION_DAYS } from '../services/trash.service';
import './trash.css';

/** F-88: fixed swipe actions for Trash — not user-configurable, since
 * restore/delete-forever are Trash-specific and unrelated to the vault's
 * delete/favorite/move/tags vocabulary in Settings. Right = restore
 * (reversible, so it's the "safe" swipe direction); left = delete forever,
 * matching the existing per-row button's own no-confirmation behavior. */
const RESTORE_REVEAL: SwipeReveal = { icon: 'RotateCw', colorVar: 'var(--color-primary)' };
const DELETE_FOREVER_REVEAL: SwipeReveal = { icon: 'Trash2', colorVar: 'var(--color-danger)' };

/** The Trash / Recycle Bin screen. */
export function TrashPage(): ReactNode {
  const { t } = useTranslation('documents');
  const { locale } = useLocale();
  const router = useIonRouter();
  const trash = useTrash();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const openPreview = (doc: DocumentEntity): void => {
    router.push(`/doc/${doc.id}?trashed=1`);
  };

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
                  <li key={doc.id} className="kg-trash__li">
                    <SwipeableRow
                      leftReveal={DELETE_FOREVER_REVEAL}
                      rightReveal={RESTORE_REVEAL}
                      onCommit={(side) => {
                        if (side === 'right') void trash.restore(doc);
                        else void trash.deleteForever(doc);
                      }}
                      agentId={`vault.trash.item.${doc.id}.swipe`}
                    >
                      <div className="kg-trash__item" data-agent-id={`vault.trash.item.${doc.id}`}>
                        <button
                          type="button"
                          className="kg-trash__meta"
                          onClick={() => openPreview(doc)}
                          aria-label={t('trash.preview', { name: doc.name })}
                          data-agent-id={`vault.trash.preview.${doc.id}`}
                        >
                          <span className="kg-trash__name">{doc.name}</span>
                          <span className="kg-trash__deleted">
                            {t('trash.deleted_on', { date: formatDate(doc.deletedAt) })}
                          </span>
                        </button>
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
                      </div>
                    </SwipeableRow>
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
