/**
 * Typed page manifest for the Trash / Recycle Bin (F-57)
 * (docs/design-system/agent-interface.md §Layer 3). Read-only for the AI: the
 * destructive actions (delete-forever, empty-trash) and even restore are
 * user-only — no Action Registry entries — so the assistant can never
 * permanently destroy or resurrect documents on the user's behalf.
 */
import { definePage } from '@kagaz/agent-kit';

export const TrashPageAgent = definePage({
  id: 'vault.trash',
  route: '/trash',
  intent:
    'Show documents the user has deleted, kept for 30 days before permanent removal, so they can restore them or delete them for good. Restore and permanent deletion are user-only actions.',
  surfaces: ['screen'],
  availableActions: [],
  observableState: {},
});
