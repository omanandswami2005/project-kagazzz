/**
 * Typed page manifest for Quick Notes (UX pass, 2026-07-23,
 * docs/design-system/agent-interface.md §Layer 3). Copy/create actions are
 * agent-actionable; delete is user-only — no Action Registry entry (see
 * quick-notes.actions.ts).
 */
import { definePage } from '@kagaz/agent-kit';
import { quickNotesActions } from '../quick-notes.actions';

export const QuickNotesPageAgent = definePage({
  id: 'vault.quick-notes',
  route: '/quick-notes',
  intent:
    'View, copy, or add personal notes — a key-value list, each entry user-named. Not behind a biometric gate; for non-sensitive data only.',
  surfaces: ['screen'],
  availableActions: [
    quickNotesActions.copyValue,
    quickNotesActions.copyWithLabel,
    quickNotesActions.createEntry,
  ],
  observableState: {},
  voiceExamples: [
    { utterance: 'open quick notes', action: 'vault.openQuickNotes' },
    { utterance: 'copy my wifi password', action: 'quicknotes.copyValue' },
    {
      utterance: 'save a note titled wifi password with value correcthorse',
      action: 'quicknotes.createEntry',
      args: { label: 'Wifi password', value: 'correcthorse' },
    },
  ],
});
