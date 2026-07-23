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
} from '@ionic/react';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import { UndoToast } from '@/core/components/UndoToast';
import { hapticDestructive, hapticTap } from '@/core/haptics';
import { usePreferencesStore } from '@/core/preferences';
import type { SwipeActionKind } from '@/core/gestures';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { DocumentListItem } from '../components/DocumentListItem';
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
  const { toggleFavorite, softDelete, restore } = useVaultMutations();
  const router = useIonRouter();
  // F-88: this page has no move/tag sheet, so only delete/favorite are
  // meaningful swipe targets here regardless of the global Settings choice.
  const swipeLeftAction = usePreferencesStore((s) =>
    s.swipeLeftAction === 'delete' || s.swipeLeftAction === 'favorite'
      ? s.swipeLeftAction
      : 'none'
  );
  const swipeRightAction = usePreferencesStore((s) =>
    s.swipeRightAction === 'delete' || s.swipeRightAction === 'favorite'
      ? s.swipeRightAction
      : 'none'
  );
  // Bug-audit follow-up (same fix as VaultHomePage's undoQueue): a single
  // overwritable slot let a second delete within the first one's 4s toast
  // window silently clobber its undo. Queued instead — every delete gets
  // its own turn.
  const [deleteQueue, setDeleteQueue] = useState<DocumentEntity[]>([]);
  const pendingUndo = deleteQueue[0] ?? null;

  const handleToggleFavorite = useCallback(
    (doc: DocumentEntity): void => {
      void toggleFavorite(doc).then(() => setReloadKey((k) => k + 1));
    },
    [toggleFavorite]
  );

  const handleSwipeAction = useCallback(
    (doc: DocumentEntity, kind: Exclude<SwipeActionKind, 'none'>): void => {
      if (kind === 'delete') {
        hapticDestructive();
        void softDelete(doc).then(() => setReloadKey((k) => k + 1));
        setDeleteQueue((queue) => [...queue, doc]);
      } else if (kind === 'favorite') {
        hapticTap();
        handleToggleFavorite(doc);
      }
    },
    [softDelete, handleToggleFavorite]
  );

  // [SEC] §3.1, bug-audit hardening: DocumentViewerPage now enforces its own
  // lock gate + markAccessed stamp — see its doc comment. Plain navigate.
  const handleOpen = useCallback(
    (doc: DocumentEntity): void => {
      router.push(`/doc/${doc.id}`);
    },
    [router]
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
                  swipeLeftAction={swipeLeftAction}
                  swipeRightAction={swipeRightAction}
                  onSwipeAction={handleSwipeAction}
                />
              ))}
            </ul>
          )}
        </main>
        <UndoToast
          isOpen={pendingUndo !== null}
          message={t('trash.moved_to_trash')}
          onUndo={() => {
            if (pendingUndo) void restore(pendingUndo).then(() => setReloadKey((k) => k + 1));
          }}
          onDidDismiss={() => setDeleteQueue((queue) => queue.slice(1))}
          agentId="vault.favorites.delete-toast"
        />
      </IonContent>
    </IonPage>
  );
}

export default FavoritesPage;
