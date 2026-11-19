/**
 * Favorites page (F-33) — the second bottom-tab destination. Lists every
 * document the user has starred, newest first, reusing the vault's
 * DocumentListItem row. Un-starring folds the row away and offers Undo
 * (FV-5); Reorder mode lets the user drag favourites into their own order (FV-4).
 */
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonReorder,
  IonReorderGroup,
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

/** How long the unstar collapse plays before the row is removed (FV-5). */
const LEAVE_MS = 250;

/** Sorts `docs` by `order` (ids); ids not in it keep their place at the end. */
function orderBy(docs: DocumentEntity[], order: readonly string[]): DocumentEntity[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const key = (d: DocumentEntity, i: number): number => rank.get(d.id) ?? order.length + i;
  return docs
    .map((d, i) => ({ d, k: key(d, i) }))
    .sort((a, b) => a.k - b.k)
    .map(({ d }) => d);
}

/** Starred-documents screen, reachable from the Favorites tab. */
export function FavoritesPage(): ReactNode {
  const { t } = useTranslation('documents');
  const [reloadKey, setReloadKey] = useState(0);
  const { favorites: loaded, isLoading } = useFavorites(reloadKey);
  // FV-4: the user's own order; new favourites join at the end.
  const favoriteOrder = usePreferencesStore((s) => s.favoriteOrder);
  const setFavoriteOrder = usePreferencesStore((s) => s.setFavoriteOrder);
  const favorites = orderBy(loaded, favoriteOrder);
  const [reordering, setReordering] = useState(false);
  // FV-5: unstarring collapses the row, then offers Undo.
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [unstarred, setUnstarred] = useState<DocumentEntity | null>(null);
  const { tagsByDocument } = useTags();
  const { toggleFavorite, softDelete, restore } = useVaultMutations();
  const router = useIonRouter();
  // F-88: this page has no move/tag sheet, so only delete/favorite are
  // meaningful swipe targets here regardless of the global Settings choice.
  const swipeLeftAction = usePreferencesStore((s) =>
    s.swipeLeftAction === 'delete' || s.swipeLeftAction === 'favorite' ? s.swipeLeftAction : 'none'
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

  // Plain functions: the React Compiler memoises them (manual useCallback
  // deps can't track the state setters used here).
  const handleToggleFavorite = (doc: DocumentEntity): void => {
    setLeavingId(doc.id);
    setTimeout(() => {
      void toggleFavorite(doc).then(() => {
        setLeavingId(null);
        setUnstarred(doc);
        setReloadKey((k) => k + 1);
      });
    }, LEAVE_MS);
  };

  const handleSwipeAction = (doc: DocumentEntity, kind: Exclude<SwipeActionKind, 'none'>): void => {
    if (kind === 'delete') {
      setSwipeDeleteTarget(doc);
    } else if (kind === 'favorite') {
      hapticTap();
      handleToggleFavorite(doc);
    }
  };

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

  const listState = isLoading ? 'loading' : favorites.length === 0 ? 'idle' : 'success';

  return (
    <IonPage data-agent-id="vault.favorites">
      <IonHeader>
        <IonToolbar>
          <MenuButton />
          <IonTitle>{t('favorites.title')}</IonTitle>
          {favorites.length > 1 && (
            <IonButtons slot="end">
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name={reordering ? 'Check' : 'Move'} size={20} />}
                onClick={() => setReordering((r) => !r)}
                agentId="vault.favorites.reorder"
              >
                {reordering ? t('favorites.done') : t('favorites.reorder')}
              </Button>
            </IonButtons>
          )}
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
              {/* FV-4: in Reorder mode, drag the handles (Ionic reorder group). */}
              <IonReorderGroup
                role="none"
                disabled={!reordering}
                onIonItemReorder={(event) => {
                  const ids = favorites.map((d) => d.id);
                  const [moved] = ids.splice(event.detail.from, 1);
                  if (moved) ids.splice(event.detail.to, 0, moved);
                  setFavoriteOrder(ids);
                  void event.detail.complete(false);
                }}
              >
                {favorites.map((document) =>
                  reordering ? (
                    <li
                      key={document.id}
                      className="kg-favorites__reorder-row"
                      data-agent-id={`vault.favorites.reorder-${document.id}`}
                    >
                      <span className="kg-favorites__reorder-name">{document.name}</span>
                      <IonReorder />
                    </li>
                  ) : (
                    <DocumentListItem
                      key={document.id}
                      leaving={leavingId === document.id}
                      document={document}
                      tags={tagsByDocument.get(document.id) ?? []}
                      onOpen={handleOpen}
                      onToggleFavorite={handleToggleFavorite}
                      onMore={setPreviewDoc}
                      swipeLeftAction={swipeLeftAction}
                      swipeRightAction={swipeRightAction}
                      onSwipeAction={handleSwipeAction}
                    />
                  )
                )}
              </IonReorderGroup>
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
          isOpen={unstarred !== null}
          message={t('favorites.removed')}
          onUndo={() => {
            if (unstarred) void toggleFavorite(unstarred).then(() => setReloadKey((k) => k + 1));
          }}
          onDidDismiss={() => setUnstarred(null)}
          agentId="vault.favorites.unstar-toast"
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
