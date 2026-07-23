/**
 * Typed page manifest for the Archived documents view (F-89)
 * (docs/design-system/agent-interface.md §Layer 3). Read-only for the AI,
 * same posture as Trash: unarchive and delete-to-trash are user-only — no
 * Action Registry entries — so state changes here always need an explicit
 * human tap.
 */
import { definePage } from '@kagaz/agent-kit';

export const ArchivedPageAgent = definePage({
  id: 'vault.archived',
  route: '/archived',
  intent:
    'Show documents the user has archived — hidden from the main vault list and Recent, but still searchable, favoritable, and included in backups. From here they can unarchive a document (back to the main list) or delete it to Trash. Both are user-only actions.',
  surfaces: ['screen'],
  availableActions: [],
  observableState: {},
});
