import { CapacitorLlmLiteRT } from '@kagaz/capacitor-llm-litert';
import { buildSystemPrompt } from '../prompts/build-system-prompt';
import type { ChatEngine } from './chat-engine';

interface UntypedEmitter {
  addListener(name: string, listener: unknown): Promise<{ remove: () => Promise<void> }>;
}

/** The native on-device engine — a pass-through to the plugin (model lifecycle lives in ai-engine.service.ts). */
export const litertChatEngine: ChatEngine = {
  kind: 'litert',
  locality: 'on-device',
  createChat: () => CapacitorLlmLiteRT.createChat({ systemPrompt: buildSystemPrompt() }),
  sendMessage: (options) => CapacitorLlmLiteRT.sendMessage(options),
  resolveToolCall: (options) => CapacitorLlmLiteRT.resolveToolCall(options),
  // The plugin declares one addListener overload per event, which a generic
  // pass-through can't satisfy; the event names/payloads match ChatEngineEvents.
  addListener: (name, listener) =>
    (CapacitorLlmLiteRT as unknown as UntypedEmitter).addListener(name, listener),
};
