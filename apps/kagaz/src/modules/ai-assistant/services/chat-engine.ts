/**
 * The chat-engine seam (05-ai-assistant-module.md §3.5). `useChat` talks to
 * this interface only; which engine sits behind it — the native LiteRT-LM
 * plugin, a local Ollama server, or (later) a hosted API — is chosen in
 * chat-engine.registry.ts. The surface deliberately mirrors the native
 * plugin's chat calls and events, so the LiteRT adapter is a pure
 * pass-through and `useChat`'s tool-call / confirmation flow is engine-agnostic.
 */
import type {
  AiFinishedEvent,
  GenerationErrorEvent,
  TextFromAiEvent,
  ToolCallRequestedEvent,
} from '@kagaz/capacitor-llm-litert';

/**
 * Where prompts and tool results go. Anything but `on-device` means user data
 * leaves the phone, so a UI warning / consent is required before enabling it
 * (the planned hosted-API fallback must show a PII data-sharing warning).
 */
export type EngineLocality = 'on-device' | 'local-server' | 'cloud';

export interface ChatEngineEvents {
  textFromAi: TextFromAiEvent;
  aiFinished: AiFinishedEvent;
  generationError: GenerationErrorEvent;
  toolCallRequested: ToolCallRequestedEvent;
}

export interface ChatEngine {
  readonly kind: 'litert' | 'ollama' | 'cloud';
  readonly locality: EngineLocality;
  /**
   * Restricts which tools the model sees (skills, §3.7). Optional: the native
   * engine fixes its tools when the conversation is created, so it omits this
   * and keeps all of them; callers must not assume it exists.
   */
  setActiveTools?(toolIds: string[]): void;
  createChat(): Promise<{ id: string }>;
  sendMessage(options: { chatId: string; message: string }): Promise<void>;
  /** Hands a tool's result (a JSON string) back to the model. */
  resolveToolCall(options: { requestId: string; resultJson: string }): Promise<void>;
  addListener<K extends keyof ChatEngineEvents>(
    name: K,
    listener: (event: ChatEngineEvents[K]) => void
  ): Promise<{ remove: () => Promise<void> }>;
}
