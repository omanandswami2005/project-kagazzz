/**
 * Picks the chat engine. The native LiteRT-LM engine is the default. Demo
 * builds can add a local Ollama server (`VITE_OLLAMA_URL`) and/or Google
 * Vertex AI through the dev proxy (`VITE_CLOUD_AI`); the user's single
 * online/offline switch (infrastructure/cloud-ai/ai-mode.ts) chooses between
 * them: online → cloud, offline → Ollama when configured, else on-device.
 */
import { getAiMode, isCloudAiConfigured } from '@/infrastructure/cloud-ai';
import { getOllamaConfig } from '@/infrastructure/ollama';
import { SYSTEM_PROMPT } from '../prompts/system-prompt';
import { skillCatalog } from '../skills/skill-registry';
import type { ChatEngine } from './chat-engine';
import { CloudChatEngine } from './cloud-chat-engine';
import { litertChatEngine } from './litert-chat-engine';
import { OllamaChatEngine } from './ollama-chat-engine';

/** Engines that talk to a server and are connected (not downloaded) from the settings screen. */
export type ServerEngine = OllamaChatEngine | CloudChatEngine;

const systemPrompt = (): string => `${SYSTEM_PROMPT}\n\n${skillCatalog()}`;

let ollamaEngine: OllamaChatEngine | null | undefined;
let cloudEngine: CloudChatEngine | null | undefined;

/** The Ollama engine when configured, else null. Singleton so listeners and history survive re-renders. */
export function getOllamaEngine(): OllamaChatEngine | null {
  if (ollamaEngine === undefined) {
    const config = getOllamaConfig();
    ollamaEngine = config
      ? new OllamaChatEngine({ baseUrl: config.baseUrl, model: config.chatModel, systemPrompt: systemPrompt() })
      : null;
  }
  return ollamaEngine;
}

/** The cloud engine when this build has the proxy, else null. */
export function getCloudEngine(): CloudChatEngine | null {
  if (cloudEngine === undefined) {
    cloudEngine = isCloudAiConfigured() ? new CloudChatEngine({ systemPrompt: systemPrompt() }) : null;
  }
  return cloudEngine;
}

/** The server engine the current mode selects, or null when the on-device engine is in use. */
export function getServerEngine(): ServerEngine | null {
  return (getAiMode() === 'online' ? getCloudEngine() : null) ?? getOllamaEngine();
}

export function getChatEngine(): ChatEngine {
  return getServerEngine() ?? litertChatEngine;
}
