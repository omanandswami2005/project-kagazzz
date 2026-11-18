/**
 * The chat-engine seam (05-ai-assistant-module.md §3.5). `useChat` talks to
 * this interface only; which engine sits behind it is chosen in
 * chat-engine.registry.ts. V1 ships only the native LiteRT-LM engine; the seam
 * stays so a later engine (V2 opt-in hosted fallback) is one new file. The surface deliberately mirrors the native
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
 * leaves the phone, so an explicit, logged consent and a PII data-sharing
 * warning are required before such an engine is enabled. V1 uses only
 * `on-device`; the other values are reserved for the V2 hosted fallback.
 */
export type EngineLocality = 'on-device' | 'local-server' | 'cloud';

export interface ChatEngineEvents {
  textFromAi: TextFromAiEvent;
  aiFinished: AiFinishedEvent;
  generationError: GenerationErrorEvent;
  toolCallRequested: ToolCallRequestedEvent;
}

export interface ChatEngine {
  /** `litert` is the only V1 engine; widen this union when another engine is added. */
  readonly kind: 'litert';
  readonly locality: EngineLocality;
  /**
   * Narrows the tools the current chat can call to a skill-sized subset (`null` = all tools).
   * The app never refuses a tool call: the model simply isn't shown the rest, because the
   * native conversation is rebuilt with only those tools (05 §3.10).
   */
  setToolSubset?(toolIds: string[] | null): void;
  createChat(): Promise<{ id: string }>;
  sendMessage(options: { chatId: string; message: string }): Promise<void>;
  /** Hands a tool's result (a JSON string) back to the model. */
  resolveToolCall(options: { requestId: string; resultJson: string }): Promise<void>;
  addListener<K extends keyof ChatEngineEvents>(
    name: K,
    listener: (event: ChatEngineEvents[K]) => void
  ): Promise<{ remove: () => Promise<void> }>;
}
