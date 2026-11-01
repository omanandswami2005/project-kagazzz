/**
 * Typed page manifest for the AI chat screen (F-13)
 * (docs/design-system/agent-interface.md §Layer 3). No AI-invokable
 * actions yet — sending a chat message is a plain user text-entry flow,
 * not something the AI would call on itself, and F-14 tool calling (the
 * AI acting on the user's behalf from inside this screen) lands
 * separately.
 */
import { definePage } from '@kagaz/agent-kit';

export const ChatPageAgent = definePage({
  id: 'ai.chat',
  route: '/ai-chat',
  intent:
    'Have a conversation with the on-device AI Assistant. Requires the AI model to be downloaded and ready first (see ai.settings) — otherwise this screen gates to a setup prompt instead of a conversation.',
  surfaces: ['screen'],
  availableActions: [],
  observableState: {},
});
