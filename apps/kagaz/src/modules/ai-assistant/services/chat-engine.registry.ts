/**
 * Picks the chat engine. The native LiteRT-LM engine is the default; a local
 * Ollama server replaces it only when `VITE_OLLAMA_URL` is set (demo builds).
 * A hosted-API engine would be a third branch here, gated behind an explicit
 * PII data-sharing consent.
 */
import { getOllamaConfig } from '@/infrastructure/ollama';
import { SYSTEM_PROMPT } from '../prompts/system-prompt';
import type { ChatEngine } from './chat-engine';
import { litertChatEngine } from './litert-chat-engine';
import { OllamaChatEngine } from './ollama-chat-engine';

let ollamaEngine: OllamaChatEngine | null | undefined;

/** The Ollama engine when configured, else null. Singleton so listeners and history survive re-renders. */
export function getOllamaEngine(): OllamaChatEngine | null {
  if (ollamaEngine === undefined) {
    const config = getOllamaConfig();
    ollamaEngine = config
      ? new OllamaChatEngine({ baseUrl: config.baseUrl, model: config.chatModel, systemPrompt: SYSTEM_PROMPT })
      : null;
  }
  return ollamaEngine;
}

export function getChatEngine(): ChatEngine {
  return getOllamaEngine() ?? litertChatEngine;
}
