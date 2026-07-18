/**
 * Typed page manifest for Quick Reference (F-84,
 * docs/design-system/agent-interface.md §Layer 3). Copy/create actions are
 * agent-actionable; the biometric unlock and delete are user-only — no
 * Action Registry entries for either (see quick-reference.actions.ts).
 */
import { definePage } from '@kagaz/agent-kit';
import { quickReferenceActions } from '../quick-reference.actions';

export const QuickReferencePageAgent = definePage({
  id: 'vault.quick-reference',
  route: '/quick-reference',
  intent:
    'View, copy, or add personal saved values (PAN, mobile, bank account, etc.) — a key-value list, each entry user-named. Behind a biometric gate.',
  surfaces: ['screen'],
  availableActions: [
    quickReferenceActions.copyValue,
    quickReferenceActions.copyWithLabel,
    quickReferenceActions.createEntry,
  ],
  observableState: {},
  voiceExamples: [
    { utterance: 'open quick reference', action: 'vault.openQuickReference' },
    { utterance: 'copy my PAN number', action: 'quickref.copyValue' },
    {
      utterance: 'save my mobile number as 9876543210',
      action: 'quickref.createEntry',
      args: { label: 'Mobile Number', value: '9876543210' },
    },
  ],
});
