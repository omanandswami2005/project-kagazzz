import { CapacitorLlmLiteRT } from '@kagaz/capacitor-llm-litert';
import { buildSystemPrompt } from '../prompts/build-system-prompt';
import type { ChatEngine } from './chat-engine';

interface UntypedEmitter {
  addListener(name: string, listener: unknown): Promise<{ remove: () => Promise<void> }>;
}

/** The native on-device engine — a pass-through to the plugin (model lifecycle lives in ai-engine.service.ts). */
let currentChatId: string | null = null;
/** The in-flight tool-subset change; the next message waits for it so it is sent to the rebuilt conversation. */
let pendingSubset: Promise<unknown> = Promise.resolve();

export const litertChatEngine: ChatEngine = {
  kind: 'litert',
  locality: 'on-device',
  createChat: async () => {
    const chat = await CapacitorLlmLiteRT.createChat({ systemPrompt: buildSystemPrompt() });
    currentChatId = chat.id;
    return chat;
  },
  setToolSubset: (toolIds) => {
    if (currentChatId) {
      pendingSubset = CapacitorLlmLiteRT.setToolSubset({
        chatId: currentChatId,
        ...(toolIds ? { tools: toolIds } : {}),
      }).catch(() => undefined);
    }
  },
  sendMessage: async (options) => {
    await pendingSubset;
    return CapacitorLlmLiteRT.sendMessage(options);
  },
  resolveToolCall: (options) => CapacitorLlmLiteRT.resolveToolCall(options),
  // The plugin declares one addListener overload per event, which a generic
  // pass-through can't satisfy; the event names/payloads match ChatEngineEvents.
  addListener: (name, listener) =>
    (CapacitorLlmLiteRT as unknown as UntypedEmitter).addListener(name, listener),
};
