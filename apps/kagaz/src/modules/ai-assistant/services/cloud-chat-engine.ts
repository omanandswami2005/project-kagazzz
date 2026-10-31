/**
 * Chat engine backed by Google Vertex AI (Gemini / Gemma) through the demo
 * proxy (`/api/ai/chat`, OpenAI-compatible chat completions). Only the wire
 * format lives here; the loop, history and tool handling are in
 * {@link ToolLoopEngine}.
 *
 * [SEC] locality is `cloud`: prompts and tool results leave the device for
 * Google Cloud. The UI must have shown a data-sharing warning and got a yes
 * before this engine is selected (see ai-mode.ts and AiAssistantPage).
 */
import { cloudChatStream, cloudHealth, type CloudHealth, type FetchLike } from '@/infrastructure/cloud-ai';
import {
  ToolLoopEngine,
  type CompletionResult,
  type NeutralMessage,
  type NeutralToolCall,
  type ToolLoopOptions,
  type ToolSpec,
} from './tool-loop-engine';

export interface CloudChatEngineOptions extends ToolLoopOptions {
  /** Sampling temperature; low keeps tool selection consistent. Default 0.2. */
  temperature?: number;
  fetchImpl?: FetchLike;
}

interface StreamDelta {
  content?: string | null;
  tool_calls?: {
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
    extra_content?: unknown;
  }[];
}

interface StreamChunk {
  choices?: { delta?: StreamDelta }[];
  error?: { message?: string };
}

function toWire(message: NeutralMessage): Record<string, unknown> {
  if (message.role === 'assistant' && message.toolCalls) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: JSON.stringify(c.args) },
        ...(c.extra !== undefined && { extra_content: c.extra }),
      })),
    };
  }
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
  }
  return { role: message.role, content: message.content };
}

export class CloudChatEngine extends ToolLoopEngine {
  readonly kind = 'cloud' as const;
  readonly locality = 'cloud' as const;

  constructor(private readonly cloud: CloudChatEngineOptions) {
    super(cloud);
  }

  /** Throws a readable error unless the proxy can reach Vertex with valid credentials. */
  async checkReady(): Promise<CloudHealth> {
    try {
      return await cloudHealth(this.cloud.fetchImpl);
    } catch (error) {
      throw new Error(`Cloud AI is not available: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }

  protected async complete(
    history: NeutralMessage[],
    tools: ToolSpec[],
    onText: (delta: string) => void
  ): Promise<CompletionResult> {
    let text = '';
    // Tool-call fragments arrive keyed by index; arguments are a string built up piece by piece.
    const partial = new Map<number, { id: string; name: string; args: string; extra?: unknown }>();
    for await (const chunk of cloudChatStream<StreamChunk>(
      {
        messages: history.map(toWire),
        ...(tools.length > 0 && { tools }),
        temperature: this.cloud.temperature ?? 0.2,
      },
      this.cloud.fetchImpl
    )) {
      if (chunk.error) {
        throw new Error(chunk.error.message ?? 'Cloud model error');
      }
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        text += delta.content;
        onText(delta.content);
      }
      for (const fragment of delta?.tool_calls ?? []) {
        const entry = partial.get(fragment.index ?? 0) ?? { id: '', name: '', args: '' };
        entry.id = fragment.id ?? entry.id;
        entry.name = fragment.function?.name ?? entry.name;
        entry.args += fragment.function?.arguments ?? '';
        entry.extra = fragment.extra_content ?? entry.extra;
        partial.set(fragment.index ?? 0, entry);
      }
    }
    const toolCalls: NeutralToolCall[] = [...partial.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, c]) => ({
        id: c.id || crypto.randomUUID(),
        name: c.name,
        args: parseArgs(c.args),
        ...(c.extra !== undefined && { extra: c.extra }),
      }));
    return { text, toolCalls };
  }
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
