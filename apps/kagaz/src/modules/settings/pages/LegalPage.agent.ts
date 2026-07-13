/**
 * Typed page manifest for the legal & attribution screens (G1-5)
 * (docs/design-system/agent-interface.md §Layer 3). Read-only: the Privacy
 * Policy, Terms & Conditions, and Open-source licenses are informational — no
 * Action Registry entries, nothing mutating.
 */
import { definePage } from '@kagaz/agent-kit';

export const LegalPageAgent = definePage({
  id: 'settings.legal',
  route: '/legal/:doc',
  intent:
    'Show one of the legal documents — Privacy Policy, Terms & Conditions, or the Open-source licenses/attributions — as read-only text reached from Settings → About.',
  surfaces: ['screen'],
  availableActions: [],
  observableState: {},
});
