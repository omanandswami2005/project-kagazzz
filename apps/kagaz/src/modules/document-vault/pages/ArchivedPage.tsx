/**
 * Archived documents page (F-89). Lists documents the user archived —
 * hidden from the main vault list and Recent, but still fully searchable,
 * still favoritable, still counted in storage, still included in the
 * encrypted backup export (see `DocumentDao.findArchived`'s own doc
 * comment for the full archive-vs-delete distinction). Unarchive brings a
 * document straight back to the main list; a document can also be deleted
 * to Trash directly from here without unarchiving first.
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
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Spinner } from '@kagaz/ui';
import { useLocale } from '@/core/i18n';
import { SwipeableRow, type SwipeReveal } from '@/core/gestures';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useArchive } from '../hooks/useArchive';
import './archived.css';

/** F-89: fixed swipe actions — not user-configurable, mirroring Trash.
 * Right = unarchive (reversible, the "safe" side); left = delete to Trash. */
const UNARCHIVE_REVEAL: SwipeReveal = { icon: 'Archive', colorVar: 'var(--color-primary)' };
const DELETE_REVEAL: SwipeReveal = { icon: 'Trash2', colorVar: 'var(--color-danger)' };

/** The Archived documents screen. */
export function ArchivedPage(): ReactNode {
  const { t } = useTranslation('documents');
  const { locale } = useLocale();
  const archive = useArchive();

  const formatDate = (iso?: string): string =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)) : '';

  return (
    <IonPage data-agent-id="vault.archived">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" data-agent-id="vault.archived.back" />
          </IonButtons>
          <IonTitle>{t('archived.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="kg-archived" data-agent-id="vault.archived.content">
          <p className="kg-archived__note">{t('archived.note')}</p>

          {archive.loading ? (
            <div className="kg-archived__empty">
              <Spinner size="lg" label={t('archived.title')} />
            </div>
          ) : archive.items.length === 0 ? (
            <div className="kg-archived__empty" data-agent-id="vault.archived.empty">
              <Icon name="Archive" size={48} aria-hidden />
              <p>{t('archived.empty_state')}</p>
            </div>
          ) : (
            <ul className="kg-archived__list" data-agent-id="vault.archived.list">
              {archive.items.map((doc: DocumentEntity) => (
                <li key={doc.id} className="kg-archived__li">
                  <SwipeableRow
                    leftReveal={DELETE_REVEAL}
                    rightReveal={UNARCHIVE_REVEAL}
                    onCommit={(side) => {
                      if (side === 'right') void archive.unarchive(doc);
                      else void archive.deleteToTrash(doc);
                    }}
                    agentId={`vault.archived.item.${doc.id}.swipe`}
                  >
                    <div className="kg-archived__item" data-agent-id={`vault.archived.item.${doc.id}`}>
                      <div className="kg-archived__meta">
                        <span className="kg-archived__name">{doc.name}</span>
                        <span className="kg-archived__updated">
                          {t('archived.updated_on', { date: formatDate(doc.updatedAt) })}
                        </span>
                      </div>
                      <div className="kg-archived__actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void archive.unarchive(doc)}
                          agentId={`vault.archived.unarchive.${doc.id}`}
                        >
                          {t('archived.unarchive')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void archive.deleteToTrash(doc)}
                          agentId={`vault.archived.delete.${doc.id}`}
                        >
                          {t('actions.delete')}
                        </Button>
                      </div>
                    </div>
                  </SwipeableRow>
                </li>
              ))}
            </ul>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
}

export default ArchivedPage;
