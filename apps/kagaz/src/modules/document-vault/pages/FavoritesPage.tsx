/**
 * Favorites page (F-33) — the second bottom-tab destination. Lists every
 * document the user has starred, newest first, reusing the vault's
 * DocumentListItem row. Un-starring here drops the row immediately.
 */
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
  useIonToast,
} from '@ionic/react';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { DocumentListItem } from '../components/DocumentListItem';
import { useDocLock } from '../hooks/useDocLock';
import { useFavorites } from '../hooks/useFavorites';
import { useTags } from '../hooks/useTags';
import { useVaultMutations } from '../hooks/useVaultMutations';
import './vault.css';

/** Starred-documents screen, reachable from the Favorites tab. */
export function FavoritesPage(): ReactNode {
  const { t } = useTranslation('documents');
  const [reloadKey, setReloadKey] = useState(0);
  const { favorites, isLoading } = useFavorites(reloadKey);
  const { tagsByDocument } = useTags();
  const { toggleFavorite, markAccessed } = useVaultMutations();
  const { authorizeView } = useDocLock();
  const router = useIonRouter();
  const [presentToast] = useIonToast();

  const handleToggleFavorite = useCallback(
    (doc: DocumentEntity): void => {
      void toggleFavorite(doc).then(() => setReloadKey((k) => k + 1));
    },
    [toggleFavorite]
  );

  const handleOpen = useCallback(
    (doc: DocumentEntity): void => {
      // [SEC] §3.1: authorize a locked document before opening the viewer.
      void authorizeView(doc).then((allowed) => {
        if (!allowed) {
          void presentToast({ message: t('lock.blocked'), duration: 1500, position: 'bottom' });
          return;
        }
        void markAccessed(doc);
        router.push(`/doc/${doc.id}`);
      });
    },
    [authorizeView, markAccessed, presentToast, router, t]
  );

  const listState = isLoading
    ? 'loading'
    : favorites.length === 0
      ? 'idle'
      : 'success';

  return (
    <IonPage data-agent-id="vault.favorites">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('favorites.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <main className="kg-vault" data-agent-id="vault.favorites.content">
          {!isLoading && favorites.length === 0 ? (
            <div
              className="kg-favorites__empty"
              data-agent-id="vault.favorites.empty"
            >
              <Icon name="Star" size={48} />
              <p className="kg-favorites__empty-title">{t('favorites.empty')}</p>
              <p className="kg-favorites__empty-hint">
                {t('favorites.empty_hint')}
              </p>
            </div>
          ) : (
            <ul
              className="kg-vault__list"
              data-agent-id="vault.favorites.list"
              data-agent-state={listState}
            >
              {favorites.map((document) => (
                <DocumentListItem
                  key={document.id}
                  document={document}
                  tags={tagsByDocument.get(document.id) ?? []}
                  onOpen={handleOpen}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </ul>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
}

export default FavoritesPage;
