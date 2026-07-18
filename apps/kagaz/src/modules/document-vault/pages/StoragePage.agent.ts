/**
 * Typed page manifest for the storage page (F-26)
 * (docs/design-system/agent-interface.md §Layer 3). Read-only — no
 * actions; the assistant reads the figures, it does not mutate here.
 */
import { definePage } from '@kagaz/agent-kit';

export const StoragePageAgent = definePage({
  id: 'vault.storage',
  route: '/storage',
  intent:
    'Show how much device storage the vault uses, broken down by file type, the largest documents, and any reclaimable duplicates.',
  surfaces: ['screen'],
  availableActions: [],
  observableState: {},
});
