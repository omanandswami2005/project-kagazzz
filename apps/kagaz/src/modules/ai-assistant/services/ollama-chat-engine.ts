/**
 * Chat engine backed by a local Ollama server (demo / desktop). Only the wire
 * format lives here; the loop, history and tool handling are in
 * {@link ToolLoopEngine}.
 *
 * [SEC] locality is `local-server`: prompts and tool results leave the
 * WebView. Demo-only; see infrastructure/ollama/ollama-config.ts.
 */
import { log } from '@/core/logging';
import { ollamaGet, ollamaStream, type FetchLike } from '@/infrastructure/ollama';
import {
  ToolLoopEngine,
  type CompletionResult,
  type NeutralMessage,
  type NeutralToolCall,
  type ToolLoopOptions,
  type ToolSpec,
} from './tool-loop-engine';

const logger = log('ai-assistant');

export interface OllamaChatEngineOptions extends ToolLoopOptions {
  baseUrl: string;
  model: string;
  /** Context window to request; the default (4096) truncates ~25 tool schemas silently. */
  numCtx?: number;
  /** Sampling temperature; low keeps tool selection consistent. Default 0.2. */
  temperature?: number;
  fetchImpl?: FetchLike;
}

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaChunk {
  message?: { content?: string; tool_calls?: OllamaToolCall[] };
  done?: boolean;
  prompt_eval_count?: number;
  error?: string;
}

function toWire(message: NeutralMessage): Record<string, unknown> {
  if (message.role === 'assistant' && message.toolCalls) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args } })),
    };
  }
  if (message.role === 'tool') {
    return { role: 'tool', tool_name: message.toolName, content: message.content };
  }
  return { role: message.role, content: message.content };
}

export class OllamaChatEngine extends ToolLoopEngine {
  readonly kind = 'ollama' as const;
  readonly locality = 'local-server' as const;

  constructor(private readonly ollama: OllamaChatEngineOptions) {
    super(ollama);
  }

  /** Throws a readable error unless the server is reachable and has the model. */
  async checkReady(): Promise<void> {
    let models: { name: string }[];
    try {
      ({ models } = await ollamaGet<{ models: { name: string }[] }>(this.ollama.baseUrl, '/api/tags', this.ollama.fetchImpl));
    } catch {
      throw new Error(`Cannot reach Ollama at ${this.ollama.baseUrl} — is "ollama serve" running?`);
    }
    const wanted = this.ollama.model;
    if (!models.some((m) => m.name === wanted || m.name === `${wanted}:latest`)) {
      throw new Error(`Ollama has no model "${wanted}" — run: ollama pull ${wanted}`);
    }
  }

  protected async complete(
    history: NeutralMessage[],
    tools: ToolSpec[],
    onText: (delta: string) => void
  ): Promise<CompletionResult> {
    let text = '';
    const toolCalls: NeutralToolCall[] = [];
    for await (const chunk of ollamaStream<OllamaChunk>(
      this.ollama.baseUrl,
      '/api/chat',
      {
        model: this.ollama.model,
        stream: true,
        messages: history.map(toWire),
        tools,
        options: { num_ctx: this.ollama.numCtx ?? 8192, temperature: this.ollama.temperature ?? 0.2 },
      },
      this.ollama.fetchImpl
    )) {
      if (chunk.error) {
        throw new Error(chunk.error);
      }
      const delta = chunk.message?.content;
      if (delta) {
        text += delta;
        onText(delta);
      }
      for (const call of chunk.message?.tool_calls ?? []) {
        toolCalls.push({ id: crypto.randomUUID(), name: call.function.name, args: call.function.arguments });
      }
      if (chunk.done) {
        logger.info({ event: 'ai.ollama.round_done', promptTokens: chunk.prompt_eval_count });
      }
    }
    return { text, toolCalls };
  }
}
