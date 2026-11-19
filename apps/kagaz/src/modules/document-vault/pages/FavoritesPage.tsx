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
import { Alert, Button, EmptyState, Icon } from '@kagaz/ui';
import { UndoToast } from '@/core/components/UndoToast';
import { hapticDestructive, hapticTap } from '@/core/haptics';
import { usePreferencesStore } from '@/core/preferences';
import type { SwipeActionKind } from '@/core/gestures';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { DocumentListItem } from '../components/DocumentListItem';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { useFavorites } from '../hooks/useFavorites';
import { useTags } from '../hooks/useTags';
import { useVaultMutations } from '../hooks/useVaultMutations';
import './vault.css';
import { MenuButton } from '@/app/shell/MenuButton';

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
  // Swipe-to-delete confirms first — same reasoning as VaultHomePage's
  // swipeDeleteTarget: a swipe is easier to trigger by accident than a
  // deliberate menu tap.
  const [swipeDeleteTarget, setSwipeDeleteTarget] = useState<DocumentEntity | null>(null);

  const handleToggleFavorite = useCallback(
    (doc: DocumentEntity): void => {
      void toggleFavorite(doc).then(() => setReloadKey((k) => k + 1));
    },
    [toggleFavorite]
  );

  const handleSwipeAction = useCallback(
    (doc: DocumentEntity, kind: Exclude<SwipeActionKind, 'none'>): void => {
      if (kind === 'delete') {
        setSwipeDeleteTarget(doc);
      } else if (kind === 'favorite') {
        hapticTap();
        handleToggleFavorite(doc);
      }
    },
    [handleToggleFavorite]
  );

  // [SEC] §3.1, bug-audit hardening: DocumentViewerPage now enforces its own
  // lock gate + markAccessed stamp — see its doc comment. Plain navigate.
  const handleOpen = useCallback(
    (doc: DocumentEntity): void => {
      router.push(`/doc/${doc.id}`);
    },
    [router]
  );

  // FV-1: rows carry ⋮ like everywhere else; here it opens the quick preview
  // (Open / Share) — the full menu lives on the document itself.
  const [previewDoc, setPreviewDoc] = useState<DocumentEntity | null>(null);

  const listState = isLoading
    ? 'loading'
    : favorites.length === 0
      ? 'idle'
      : 'success';

  return (
    <IonPage data-agent-id="vault.favorites">
      <IonHeader>
        <IonToolbar>
          <MenuButton />
          <IonTitle>{t('favorites.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <main className="kg-vault" data-agent-id="vault.favorites.content">
          {!isLoading && favorites.length === 0 ? (
            <EmptyState
              icon="Star"
              title={t('favorites.empty')}
              hint={t('favorites.empty_hint')}
              agentId="vault.favorites.empty"
              action={
                // FV-3: the way to fill this list is from the documents list.
                <Button
                  variant="secondary"
                  icon={<Icon name="Folder" size={20} />}
                  onClick={() => router.push('/vault', 'root', 'replace')}
                  agentId="vault.favorites.browse"
                >
                  {t('favorites.browse')}
                </Button>
              }
            />
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
                  onMore={setPreviewDoc}
                  swipeLeftAction={swipeLeftAction}
                  swipeRightAction={swipeRightAction}
                  onSwipeAction={handleSwipeAction}
                />
              ))}
            </ul>
          )}
        </main>
        <DocumentPreviewModal
          document={previewDoc}
          onOpen={(doc) => {
            setPreviewDoc(null);
            handleOpen(doc);
          }}
          onClose={() => setPreviewDoc(null)}
        />
        <UndoToast
          isOpen={pendingUndo !== null}
          message={t('trash.moved_to_trash')}
          onUndo={() => {
            if (pendingUndo) void restore(pendingUndo).then(() => setReloadKey((k) => k + 1));
          }}
          onDidDismiss={() => setDeleteQueue((queue) => queue.slice(1))}
          agentId="vault.favorites.delete-toast"
        />
        <Alert
          key={swipeDeleteTarget?.id ?? 'swipe-delete-none'}
          isOpen={swipeDeleteTarget !== null}
          header={t('actions.delete_confirm_title', { name: swipeDeleteTarget?.name ?? '' })}
          message={t('actions.delete_confirm_message')}
          agentId="vault.favorites.swipe-delete-confirm"
          buttons={[
            {
              text: t('actions.delete'),
              role: 'destructive',
              handler: (): void => {
                if (swipeDeleteTarget) {
                  hapticDestructive();
                  void softDelete(swipeDeleteTarget).then(() => setReloadKey((k) => k + 1));
                  setDeleteQueue((queue) => [...queue, swipeDeleteTarget]);
                }
              },
            },
            { text: t('actions.cancel'), role: 'cancel' },
          ]}
          onDidDismiss={() => setSwipeDeleteTarget(null)}
        />
      </IonContent>
    </IonPage>
  );
}

export default FavoritesPage;
