/**
 * Picks the chat engine. V1 ships exactly one: the native on-device LiteRT-LM
 * engine (Gemma 4 E2B). Nothing leaves the phone.
 *
 * Extension point: a future engine (e.g. the V2 opt-in hosted fallback in
 * 05-ai-assistant-module.md §3.5) implements {@link ChatEngine} in its own file
 * and is selected here. Any engine whose `locality` is not `on-device` must sit
 * behind an explicit, logged consent (DPDP §6) and a data-sharing warning
 * before it is ever returned from this function.
 */
import type { ChatEngine } from './chat-engine';
import { litertChatEngine } from './litert-chat-engine';

/** The engine `useChat` talks to. */
export function getChatEngine(): ChatEngine {
  return litertChatEngine;
}
