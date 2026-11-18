/**
 * Typed page manifest for the AI Assistant settings screen (F-13)
 * (docs/design-system/agent-interface.md §Layer 3). Downloading and
 * deleting the on-device model are both user-only — no Action Registry
 * entries — a multi-hundred-MB download or losing the assistant's
 * capability entirely should never happen without an explicit human tap.
 */
import { definePage } from '@kagaz/agent-kit';

export const AiAssistantPageAgent = definePage({
  id: 'ai.settings',
  route: '/ai-assistant',
  intent:
    'Manage the on-device AI Assistant model: download it (one-time, ~2.6 GB), load it, see its status, or delete it (confirmed) to free storage. A downloaded model is remembered across restarts and the AI chat loads it automatically.',
  surfaces: ['screen'],
  availableActions: [],
  // AI status lives in React context (AIProvider), not a store with a
  // getState() outside the component tree, so there's nothing to read here
  // synchronously — same reasoning as ArchivedPage's own empty entry. The
  // status is visible via data-agent-state on the page's content element.
  observableState: {},
});
