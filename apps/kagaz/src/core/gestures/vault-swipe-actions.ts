/**
 * The document-row swipe action vocabulary (F-88): what Settings lets a
 * user bind to swipe-left/swipe-right, and what `DocumentListItem`/
 * `FavoritesPage` dispatch on commit. Lives in `core/` (not the
 * document-vault module) because `core/preferences` — which must stay
 * module-agnostic — persists these two choices.
 */
import type { IconName } from '@kagaz/ui';
import type { SwipeReveal } from './SwipeableRow';

/** The set of actions a document row can bind to swipe-left / swipe-right. */
export type SwipeActionKind =
  | 'delete'
  | 'favorite'
  | 'move'
  | 'tags'
  | 'archive'
  | 'none';

/** Icon + theme color for each swipe action (`none` never renders). */
export const SWIPE_ACTION_META: Record<
  Exclude<SwipeActionKind, 'none'>,
  SwipeReveal & { icon: IconName }
> = {
  delete: { icon: 'Trash2', colorVar: 'var(--color-danger)' },
  favorite: { icon: 'Star', colorVar: 'var(--color-warning)' },
  move: { icon: 'FolderInput', colorVar: 'var(--color-primary)' },
  tags: { icon: 'Tag', colorVar: 'var(--color-primary)' },
  archive: { icon: 'Archive', colorVar: 'var(--color-primary)' },
};

/** Resolves a {@link SwipeActionKind} to its reveal, or `null` for `'none'`. */
export function swipeReveal(kind: SwipeActionKind): SwipeReveal | null {
  return kind === 'none' ? null : SWIPE_ACTION_META[kind];
}
