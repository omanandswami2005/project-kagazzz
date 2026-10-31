/**
 * Shared chat loop for engines that talk to a stateless HTTP model server
 * (local Ollama, cloud Vertex). It owns everything that is not wire format:
 * per-chat history, the model↔tool round trips, the 30 s tool timeout, the
 * round cap, history trimming and the listener plumbing — so each engine is
 * only {@link ToolLoopEngine.complete} (one streamed model call) plus a
 * readiness check. Messages are kept in a neutral shape and mapped to the
 * wire format by the subclass.
 */
import type { ToolDescriptor } from '@kagaz/capacitor-llm-litert';
import { log } from '@/core/logging';
import type { ChatEngine, ChatEngineEvents, EngineLocality } from './chat-engine';

const logger = log('ai-assistant');

export interface NeutralToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** Provider-specific extras that must be echoed back (e.g. Gemini's thought signature). */
  extra?: unknown;
}

export interface NeutralMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: NeutralToolCall[];
  /** For role `tool`: which call this answers. */
  toolCallId?: string;
  toolName?: string;
}

export interface ToolSpec {
  type: 'function';
  function: unknown;
}

export interface CompletionResult {
  text: string;
  toolCalls: NeutralToolCall[];
}

export interface ToolLoopOptions {
  systemPrompt: string;
  /** Max model↔tool round trips per user message — guards against tool loops. */
  maxToolRounds?: number;
  /** Matches the native bridge's 30 s; an unanswered tool call resolves to a timeout result. */
  toolTimeoutMs?: number;
  /** Non-system messages kept per chat before the oldest are dropped. */
  maxHistoryMessages?: number;
}

type Listener<K extends keyof ChatEngineEvents> = (event: ChatEngineEvents[K]) => void;

export abstract class ToolLoopEngine implements ChatEngine {
  abstract readonly kind: ChatEngine['kind'];
  abstract readonly locality: EngineLocality;

  private allTools: { id: string; tool: ToolSpec }[] = [];
  private activeIds: Set<string> | null = null;
  private readonly histories = new Map<string, NeutralMessage[]>();
  private readonly busy = new Set<string>();
  private readonly pending = new Map<string, { resolve: (resultJson: string) => void; timer: ReturnType<typeof setTimeout> }>();
  private readonly listeners: { [K in keyof ChatEngineEvents]: Set<Listener<K>> } = {
    textFromAi: new Set(),
    aiFinished: new Set(),
    generationError: new Set(),
    toolCallRequested: new Set(),
  };

  protected constructor(protected readonly options: ToolLoopOptions) {}

  /** One streamed model call: send `history` + `tools`, report text deltas, return the final text and tool calls. */
  protected abstract complete(
    history: NeutralMessage[],
    tools: ToolSpec[],
    onText: (delta: string) => void
  ): Promise<CompletionResult>;

  /** Registers the tool set (from the Action Registry). */
  setTools(descriptors: ToolDescriptor[]): void {
    this.allTools = descriptors.map((d) => ({
      id: d.name,
      tool: { type: 'function', function: JSON.parse(d.descriptionJson) as unknown },
    }));
  }

  /** Only these tools are sent from now on (skills); until called, every registered tool is. */
  setActiveTools(toolIds: string[]): void {
    this.activeIds = new Set(toolIds);
  }

  protected currentTools(): ToolSpec[] {
    return this.allTools.filter((t) => !this.activeIds || this.activeIds.has(t.id)).map((t) => t.tool);
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
      logger.warn({ event: 'ai.engine.turn_failed', engine: this.kind, err: { message: String(error) } });
      this.emit('generationError', { chatId, error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.busy.delete(chatId);
      this.trim(history);
    }
  }

  private async runTurn(chatId: string, history: NeutralMessage[]): Promise<void> {
    const maxRounds = this.options.maxToolRounds ?? 5;
    for (let round = 0; round <= maxRounds; round++) {
      const { text, toolCalls } = await this.complete(history, this.currentTools(), (delta) =>
        this.emit('textFromAi', { chatId, text: delta })
      );
      history.push({ role: 'assistant', content: text, ...(toolCalls.length > 0 && { toolCalls }) });
      if (toolCalls.length === 0) {
        return;
      }
      if (round === maxRounds) {
        throw new Error('The assistant made too many tool calls in a row — try a simpler request.');
      }
      for (const call of toolCalls) {
        const resultJson = await this.requestTool(call.name, call.args);
        history.push({ role: 'tool', toolCallId: call.id, toolName: call.name, content: resultJson });
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
  private trim(history: NeutralMessage[]): void {
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
