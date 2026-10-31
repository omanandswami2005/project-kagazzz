import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaChatEngine } from '../ollama-chat-engine';

/** One streamed /api/chat response made of NDJSON chunks. */
function ndjson(...chunks: object[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(encoder.encode(`${JSON.stringify(c)}\n`)));
        controller.close();
      },
    })
  );
}

const text = (content: string): object[] => [{ message: { content } }, { message: { content: '' }, done: true }];
const toolCall = (name: string, args: object): object[] => [
  { message: { content: '', tool_calls: [{ function: { name, arguments: args } }] } },
  { done: true },
];

function makeEngine(responses: Response[], overrides: Partial<ConstructorParameters<typeof OllamaChatEngine>[0]> = {}) {
  const fetchImpl = vi.fn();
  responses.forEach((r) => fetchImpl.mockResolvedValueOnce(r));
  const engine = new OllamaChatEngine({
    baseUrl: 'http://x',
    model: 'gemma4:e2b',
    systemPrompt: 'SYS',
    fetchImpl: fetchImpl,
    ...overrides,
  });
  engine.setTools([{ name: 'ai.listDocuments', descriptionJson: JSON.stringify({ name: 'ai.listDocuments', description: 'd', parameters: { type: 'object', properties: {} } }) }]);
  return { engine, fetchImpl };
}

async function collect(engine: OllamaChatEngine) {
  const events: { type: string; payload: unknown }[] = [];
  for (const type of ['textFromAi', 'aiFinished', 'generationError', 'toolCallRequested'] as const) {
    await engine.addListener(type, (payload: unknown) => events.push({ type, payload }));
  }
  return events;
}

interface SentBody {
  messages: { role: string; content: string }[];
  tools: unknown[];
  options: { num_ctx: number };
}
const bodyOf = (fetchImpl: ReturnType<typeof vi.fn>, call: number): SentBody =>
  JSON.parse((fetchImpl.mock.calls[call] as [string, RequestInit])[1].body as string) as SentBody;

afterEach(() => vi.useRealTimers());

describe('OllamaChatEngine', () => {
  it('streams text then finishes, sending the system prompt, tools and num_ctx', async () => {
    const { engine, fetchImpl } = makeEngine([ndjson(...text('Hello'))]);
    const events = await collect(engine);
    const { id } = await engine.createChat();

    await engine.sendMessage({ chatId: id, message: 'hi' });

    expect(events.map((e) => e.type)).toEqual(['textFromAi', 'aiFinished']);
    expect(events[0].payload).toEqual({ chatId: id, text: 'Hello' });
    const body = bodyOf(fetchImpl, 0);
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(body.messages[0].content).toBe('SYS');
    expect(body.tools).toHaveLength(1);
    expect(body.options.num_ctx).toBe(8192);
  });

  it('runs the tool loop: emits toolCallRequested, waits for resolveToolCall, then answers with the result in history', async () => {
    const { engine, fetchImpl } = makeEngine([
      ndjson(...toolCall('ai.listDocuments', { limit: 3 })),
      ndjson(...text('You have 2 docs')),
    ]);
    const events = await collect(engine);
    await engine.addListener('toolCallRequested', (e) => void engine.resolveToolCall({ requestId: e.requestId, resultJson: '{"ok":true}' }));
    const { id } = await engine.createChat();

    await engine.sendMessage({ chatId: id, message: 'list my docs' });

    const call = events.find((e) => e.type === 'toolCallRequested')?.payload as { name: string; argumentsJson: string };
    expect(call.name).toBe('ai.listDocuments');
    expect(JSON.parse(call.argumentsJson)).toEqual({ limit: 3 });
    const second = bodyOf(fetchImpl, 1).messages;
    expect(second.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    expect(second[3].content).toBe('{"ok":true}');
    expect(events.at(-1)?.type).toBe('aiFinished');
  });

  it('resolves an unanswered tool call to a timeout result instead of hanging', async () => {
    vi.useFakeTimers();
    const { engine, fetchImpl } = makeEngine(
      [ndjson(...toolCall('ai.listDocuments', {})), ndjson(...text('ok'))],
      { toolTimeoutMs: 1000 }
    );
    const { id } = await engine.createChat();

    const run = engine.sendMessage({ chatId: id, message: 'x' });
    await vi.advanceTimersByTimeAsync(1500);
    await run;

    expect(bodyOf(fetchImpl, 1).messages.at(-1)?.content).toContain('timed out');
  });

  it('stops a runaway tool loop with a generationError', async () => {
    const looping = Array.from({ length: 4 }, () => ndjson(...toolCall('ai.listDocuments', {})));
    const { engine } = makeEngine(looping, { maxToolRounds: 2 });
    const events = await collect(engine);
    await engine.addListener('toolCallRequested', (e) => void engine.resolveToolCall({ requestId: e.requestId, resultJson: '{}' }));
    const { id } = await engine.createChat();

    await engine.sendMessage({ chatId: id, message: 'x' });

    const last = events.at(-1);
    expect(last?.type).toBe('generationError');
    expect((last?.payload as { error: string }).error).toContain('too many tool calls');
  });

  it('turns HTTP failures into generationError rather than rejecting, and rejects overlapping sends', async () => {
    const { engine } = makeEngine([new Response('boom', { status: 500 })]);
    const events = await collect(engine);
    const { id } = await engine.createChat();
    await expect(engine.sendMessage({ chatId: id, message: 'x' })).resolves.toBeUndefined();
    expect(events.at(-1)?.type).toBe('generationError');

    const slow = makeEngine([ndjson(...text('a'))]);
    const slowEvents = await collect(slow.engine);
    const chat = await slow.engine.createChat();
    const first = slow.engine.sendMessage({ chatId: chat.id, message: '1' });
    await slow.engine.sendMessage({ chatId: chat.id, message: '2' });
    await first;
    expect(slowEvents.some((e) => e.type === 'generationError')).toBe(true);
  });

  it('drops the oldest turns past the cap but keeps the system prompt and starts on a user turn', async () => {
    const { engine, fetchImpl } = makeEngine(
      Array.from({ length: 6 }, () => ndjson(...text('r'))),
      { maxHistoryMessages: 4 }
    );
    const { id } = await engine.createChat();
    for (let i = 0; i < 6; i++) {
      await engine.sendMessage({ chatId: id, message: `m${i}` });
    }
    const last = bodyOf(fetchImpl, 5).messages;
    expect(last[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(last[1].role).toBe('user');
    expect(last.length).toBeLessThanOrEqual(6);
  });

  it('sends only the active tools once setActiveTools is called, and all of them before that', async () => {
    const { engine, fetchImpl } = makeEngine([ndjson(...text('a')), ndjson(...text('b'))]);
    engine.setTools([
      { name: 'core.one', descriptionJson: JSON.stringify({ name: 'core.one', description: 'c', parameters: { type: 'object', properties: {} } }) },
      { name: 'skill.two', descriptionJson: JSON.stringify({ name: 'skill.two', description: 's', parameters: { type: 'object', properties: {} } }) },
    ]);
    const { id } = await engine.createChat();

    await engine.sendMessage({ chatId: id, message: 'x' });
    expect(bodyOf(fetchImpl, 0).tools).toHaveLength(2);

    engine.setActiveTools(['core.one']);
    await engine.sendMessage({ chatId: id, message: 'y' });
    expect(bodyOf(fetchImpl, 1).tools).toHaveLength(1);
  });

  it('checkReady explains an unreachable server and a missing model', async () => {
    const unreachable = new OllamaChatEngine({ baseUrl: 'http://x', model: 'gemma4:e2b', systemPrompt: '', fetchImpl: vi.fn().mockRejectedValue(new Error('down')) });
    await expect(unreachable.checkReady()).rejects.toThrow('ollama serve');

    const noModel = new OllamaChatEngine({ baseUrl: 'http://x', model: 'gemma4:e2b', systemPrompt: '', fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ name: 'other' }] }))) });
    await expect(noModel.checkReady()).rejects.toThrow('ollama pull gemma4:e2b');

    const ok = new OllamaChatEngine({ baseUrl: 'http://x', model: 'gemma4:e2b', systemPrompt: '', fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ name: 'gemma4:e2b' }] }))) });
    await expect(ok.checkReady()).resolves.toBeUndefined();
  });
});
