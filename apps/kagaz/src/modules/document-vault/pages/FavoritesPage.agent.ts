/**
 * Typed page manifest for the favorites page (F-33)
 * (docs/design-system/agent-interface.md §Layer 3). The only mutation is
 * un-starring a row, which reuses the vault's toggle-favorite action.
 */
import { definePage } from '@kagaz/agent-kit';
import { vaultActions } from '../vault.actions';

export const FavoritesPageAgent = definePage({
  id: 'vault.favorites',
  route: '/favorites',
  intent:
    'List every document the user has starred as a favorite, newest first, so they can reopen or un-star them quickly.',
  surfaces: ['screen'],
  availableActions: [vaultActions.toggleFavorite],
  observableState: {},
});
