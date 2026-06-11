/**
 * Typed page manifest for the shell home page
 * (docs/design-system/agent-interface.md §Layer 3).
 */
import { definePage } from '@kagaz/agent-kit';

export const HomePageAgent = definePage({
  id: 'app.home',
  route: '/',
  intent:
    'Landing screen of the app shell. Shows the empty vault state; document features arrive with F-1.',
  surfaces: ['screen'],
  availableActions: [],
  observableState: {},
});
