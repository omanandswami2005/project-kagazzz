/**
 * Chat engine backed by a local Ollama server (demo / desktop). Implements the
 * same {@link ChatEngine} surface as the native plugin, so `useChat`'s tool
 * dispatch and confirmation cards work unchanged: the model's tool calls are
 * emitted as `toolCallRequested` events and the loop waits for
 * `resolveToolCall`, exactly like the native bridge.
 *
 * Ollama is stateless, so the message history per chat lives here.
 *
 * [SEC] locality is `local-server`: prompts and tool results leave the
 * WebView. Demo-only; see infrastructure/ollama/ollama-config.ts.
 */
import type { ToolDescriptor } from '@kagaz/capacitor-llm-litert';
import { log } from '@/core/logging';
import { ollamaGet, ollamaStream, type FetchLike } from '@/infrastructure/ollama';
import type { ChatEngine, ChatEngineEvents } from './chat-engine';

const logger = log('ai-assistant');

export interface OllamaChatEngineOptions {
  baseUrl: string;
  model: string;
  systemPrompt: string;
  /** Context window to request; the default (4096) truncates ~25 tool schemas silently. */
  numCtx?: number;
  /** Sampling temperature; low keeps tool selection consistent. Default 0.2. */
  temperature?: number;
  /** Max model↔tool round trips per user message — guards against tool loops. */
  maxToolRounds?: number;
  /** Matches the native bridge's 30s; an unanswered tool call resolves to a timeout result. */
  toolTimeoutMs?: number;
  /** Non-system messages kept per chat before the oldest are dropped. */
  maxHistoryMessages?: number;
  fetchImpl?: FetchLike;
}

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
}

interface OllamaChunk {
  message?: { content?: string; tool_calls?: OllamaToolCall[] };
  done?: boolean;
  prompt_eval_count?: number;
  error?: string;
}

type Listener<K extends keyof ChatEngineEvents> = (event: ChatEngineEvents[K]) => void;

export class OllamaChatEngine implements ChatEngine {
  readonly kind = 'ollama' as const;
  readonly locality = 'local-server' as const;

  private tools: { type: 'function'; function: unknown }[] = [];
  private readonly histories = new Map<string, OllamaMessage[]>();
  private readonly busy = new Set<string>();
  private readonly pending = new Map<string, { resolve: (resultJson: string) => void; timer: ReturnType<typeof setTimeout> }>();
  private readonly listeners: { [K in keyof ChatEngineEvents]: Set<Listener<K>> } = {
    textFromAi: new Set(),
    aiFinished: new Set(),
    generationError: new Set(),
    toolCallRequested: new Set(),
  };

  constructor(private readonly options: OllamaChatEngineOptions) {}

  /** Registers the tool set sent with every request (from the Action Registry). */
  setTools(descriptors: ToolDescriptor[]): void {
    this.tools = descriptors.map((d) => ({
      type: 'function',
      function: JSON.parse(d.descriptionJson) as unknown,
    }));
  }

  /** Throws a readable error unless the server is reachable and has the model. */
  async checkReady(): Promise<void> {
    let models: { name: string }[];
    try {
      ({ models } = await ollamaGet<{ models: { name: string }[] }>(
        this.options.baseUrl,
        '/api/tags',
        this.options.fetchImpl
      ));
    } catch {
      throw new Error(`Cannot reach Ollama at ${this.options.baseUrl} — is "ollama serve" running?`);
    }
    const wanted = this.options.model;
    if (!models.some((m) => m.name === wanted || m.name === `${wanted}:latest`)) {
      throw new Error(`Ollama has no model "${wanted}" — run: ollama pull ${wanted}`);
    }
  }

  createChat(): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    this.histories.set(id, [{ role: 'system', content: this.options.systemPrompt }]);
    return Promise.resolve({ id });
  }

  addListener<K extends keyof ChatEngineEvents>(
    name: K,
    listener: (event: ChatEngineEvents[K]) => void
  ): Promise<{ remove: () => Promise<void> }> {
    (this.listeners[name] as Set<Listener<K>>).add(listener);
    return Promise.resolve({
      remove: (): Promise<void> => {
        (this.listeners[name] as Set<Listener<K>>).delete(listener);
        return Promise.resolve();
      },
    });
  }

  resolveToolCall({ requestId, resultJson }: { requestId: string; resultJson: string }): Promise<void> {
    const entry = this.pending.get(requestId);
    if (entry) {
      clearTimeout(entry.timer);
      this.pending.delete(requestId);
      entry.resolve(resultJson);
    }
    // Unknown id = already timed out: benign no-op, same contract as the native bridge.
    return Promise.resolve();
  }

  /** Runs one user turn; failures surface as a `generationError` event, never a rejection. */
  async sendMessage({ chatId, message }: { chatId: string; message: string }): Promise<void> {
    const history = this.histories.get(chatId);
    if (!history) {
      this.emit('generationError', { chatId, error: 'Unknown chat session' });
      return;
    }
    if (this.busy.has(chatId)) {
      this.emit('generationError', { chatId, error: 'The assistant is still answering — wait a moment.' });
      return;
    }
    this.busy.add(chatId);
    history.push({ role: 'user', content: message });
    try {
      await this.runTurn(chatId, history);
      this.emit('aiFinished', { chatId });
    } catch (error) {
      logger.warn({ event: 'ai.ollama.turn_failed', err: { message: String(error) } });
      this.emit('generationError', { chatId, error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.busy.delete(chatId);
      this.trim(history);
    }
  }

  private async runTurn(chatId: string, history: OllamaMessage[]): Promise<void> {
    const maxRounds = this.options.maxToolRounds ?? 5;
    for (let round = 0; round <= maxRounds; round++) {
      let text = '';
      const calls: OllamaToolCall[] = [];
      for await (const chunk of ollamaStream<OllamaChunk>(
        this.options.baseUrl,
        '/api/chat',
        {
          model: this.options.model,
          stream: true,
          messages: history,
          tools: this.tools,
          options: { num_ctx: this.options.numCtx ?? 8192, temperature: this.options.temperature ?? 0.2 },
        },
        this.options.fetchImpl
      )) {
        if (chunk.error) {
          throw new Error(chunk.error);
        }
        const delta = chunk.message?.content;
        if (delta) {
          text += delta;
          this.emit('textFromAi', { chatId, text: delta });
        }
        if (chunk.message?.tool_calls) {
          calls.push(...chunk.message.tool_calls);
        }
        if (chunk.done) {
          logger.info({ event: 'ai.ollama.round_done', round, promptTokens: chunk.prompt_eval_count });
        }
      }
      history.push({ role: 'assistant', content: text, ...(calls.length > 0 && { tool_calls: calls }) });
      if (calls.length === 0) {
        return;
      }
      if (round === maxRounds) {
        throw new Error('The assistant made too many tool calls in a row — try a simpler request.');
      }
      for (const call of calls) {
        const resultJson = await this.requestTool(call.function.name, call.function.arguments);
        history.push({ role: 'tool', tool_name: call.function.name, content: resultJson });
      }
    }
  }

  /** Emits `toolCallRequested` and waits for `resolveToolCall` (or the timeout). */
  private requestTool(name: string, args: Record<string, unknown>): Promise<string> {
    const requestId = crypto.randomUUID();
    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve(JSON.stringify({ ok: false, error: 'Tool call timed out waiting for the user or the app' }));
      }, this.options.toolTimeoutMs ?? 30_000);
      this.pending.set(requestId, { resolve, timer });
      this.emit('toolCallRequested', { requestId, name, argumentsJson: JSON.stringify(args ?? {}) });
    });
  }

  /** Drops the oldest turns past the cap, always restarting at a user message so no tool result is orphaned. */
  private trim(history: OllamaMessage[]): void {
    const max = this.options.maxHistoryMessages ?? 40;
    if (history.length - 1 <= max) {
      return;
    }
    let cut = history.length - max;
    while (cut < history.length && history[cut].role !== 'user') {
      cut++;
    }
    history.splice(1, cut - 1);
  }

  private emit<K extends keyof ChatEngineEvents>(name: K, event: ChatEngineEvents[K]): void {
    (this.listeners[name] as Set<Listener<K>>).forEach((listener) => listener(event));
  }
}
