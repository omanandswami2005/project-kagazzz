import { describe, expect, it, vi } from 'vitest';
import { CloudChatEngine } from '../cloud-chat-engine';

/** One streamed SSE response. */
function sse(...chunks: object[]): Response {
  return new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n');
}
const delta = (d: object): object => ({ choices: [{ delta: d }] });
const textChunk = (content: string): object => delta({ role: 'assistant', content });
const toolChunk = (name: string, args: string, extra?: object): object =>
  delta({ tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name, arguments: args }, ...(extra && { extra_content: extra }) }] });

function make(responses: Response[]) {
  const fetchImpl = vi.fn();
  responses.forEach((r) => fetchImpl.mockResolvedValueOnce(r));
  const engine = new CloudChatEngine({ systemPrompt: 'SYS', fetchImpl: fetchImpl });
  engine.setTools([
    { name: 'ai.listDocuments', descriptionJson: JSON.stringify({ name: 'ai.listDocuments', description: 'd', parameters: { type: 'object', properties: {} } }) },
  ]);
  return { engine, fetchImpl };
}

interface Sent {
  messages: Record<string, unknown>[];
  tools?: unknown[];
  stream: boolean;
}
const sent = (fetchImpl: ReturnType<typeof vi.fn>, call: number): Sent =>
  JSON.parse((fetchImpl.mock.calls[call] as [string, RequestInit])[1].body as string) as Sent;

async function collect(engine: CloudChatEngine) {
  const events: { type: string; payload: unknown }[] = [];
  for (const type of ['textFromAi', 'aiFinished', 'generationError', 'toolCallRequested'] as const) {
    await engine.addListener(type, (payload: unknown) => events.push({ type, payload }));
  }
  return events;
}

describe('CloudChatEngine', () => {
  it('streams text and sends the system prompt, tools and stream:true to /api/ai/chat', async () => {
    const { engine, fetchImpl } = make([sse(textChunk('Hel'), textChunk('lo'))]);
    const events = await collect(engine);
    const { id } = await engine.createChat();

    await engine.sendMessage({ chatId: id, message: 'hi' });

    expect(events.filter((e) => e.type === 'textFromAi').map((e) => (e.payload as { text: string }).text)).toEqual(['Hel', 'lo']);
    expect(events.at(-1)?.type).toBe('aiFinished');
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe('/api/ai/chat');
    const body = sent(fetchImpl, 0);
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(body.tools).toHaveLength(1);
  });

  it('assembles a tool call from argument fragments, runs it, and replays the call + result in OpenAI shape', async () => {
    const { engine, fetchImpl } = make([
      sse(
        delta({ tool_calls: [{ index: 0, id: 'call-1', function: { name: 'ai.listDocuments', arguments: '{"lim' } }] }),
        delta({ tool_calls: [{ index: 0, function: { arguments: 'it":3}' } }], })
      ),
      sse(textChunk('You have 2 docs')),
    ]);
    const events = await collect(engine);
    await engine.addListener('toolCallRequested', (e) => void engine.resolveToolCall({ requestId: e.requestId, resultJson: '{"ok":true}' }));
    const { id } = await engine.createChat();

    await engine.sendMessage({ chatId: id, message: 'list' });

    const call = events.find((e) => e.type === 'toolCallRequested')?.payload as { name: string; argumentsJson: string };
    expect(call.name).toBe('ai.listDocuments');
    expect(JSON.parse(call.argumentsJson)).toEqual({ limit: 3 });

    const second = sent(fetchImpl, 1).messages;
    expect(second.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    expect((second[2].tool_calls as { id: string; function: { arguments: string } }[])[0]).toMatchObject({
      id: 'call-1',
      type: 'function',
      function: { name: 'ai.listDocuments', arguments: '{"limit":3}' },
    });
    expect(second[3]).toEqual({ role: 'tool', tool_call_id: 'call-1', content: '{"ok":true}' });
  });

  it('echoes provider extras (Gemini thought signature) back on the assistant tool call', async () => {
    const extra = { google: { thought_signature: 'sig' } };
    const { engine, fetchImpl } = make([sse(toolChunk('ai.listDocuments', '{}', extra)), sse(textChunk('ok'))]);
    await engine.addListener('toolCallRequested', (e) => void engine.resolveToolCall({ requestId: e.requestId, resultJson: '{}' }));
    const { id } = await engine.createChat();
    await engine.sendMessage({ chatId: id, message: 'x' });

    const assistant = sent(fetchImpl, 1).messages[2] as { tool_calls: { extra_content: unknown }[] };
    expect(assistant.tool_calls[0].extra_content).toEqual(extra);
  });

  it('tolerates empty or invalid tool arguments by treating them as {}', async () => {
    const { engine } = make([sse(toolChunk('ai.listDocuments', '')), sse(textChunk('ok'))]);
    const events = await collect(engine);
    await engine.addListener('toolCallRequested', (e) => void engine.resolveToolCall({ requestId: e.requestId, resultJson: '{}' }));
    const { id } = await engine.createChat();
    await engine.sendMessage({ chatId: id, message: 'x' });
    const call = events.find((e) => e.type === 'toolCallRequested')?.payload as { argumentsJson: string };
    expect(call.argumentsJson).toBe('{}');
  });

  it('turns an HTTP failure into a generationError, not a rejection', async () => {
    const { engine } = make([new Response(JSON.stringify({ error: 'gcloud failed' }), { status: 502 })]);
    const events = await collect(engine);
    const { id } = await engine.createChat();
    await expect(engine.sendMessage({ chatId: id, message: 'x' })).resolves.toBeUndefined();
    const last = events.at(-1);
    expect(last?.type).toBe('generationError');
    expect((last?.payload as { error: string }).error).toContain('gcloud failed');
  });

  it('checkReady reports the project, or a readable reason when credentials are missing', async () => {
    const ok = new CloudChatEngine({ systemPrompt: '', fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, project: 'proj-1', chatModel: 'm', embeddingModel: 'e' }))) });
    expect((await ok.checkReady()).project).toBe('proj-1');

    const bad = new CloudChatEngine({ systemPrompt: '', fetchImpl: vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: 'gcloud failed — run: gcloud auth application-default login' }), { status: 502 }))) });
    await expect(bad.checkReady()).rejects.toThrow('application-default login');
  });

  it('ends the turn after an end-turn tool (ai.askUser): the model is not called again', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(sse(toolChunk('ai.askUser', '{"question":"q","fields":[]}')));
    const engine = new CloudChatEngine({ systemPrompt: 'SYS', endTurnTools: ['ai.askUser'], fetchImpl: fetchImpl });
    engine.setTools([{ name: 'ai.askUser', descriptionJson: JSON.stringify({ name: 'ai.askUser', description: 'd', parameters: { type: 'object', properties: {} } }) }]);
    const events = await collect(engine);
    await engine.addListener('toolCallRequested', (e) => void engine.resolveToolCall({ requestId: e.requestId, resultJson: '{"ok":true,"data":{"status":"waiting_for_user"}}' }));
    const { id } = await engine.createChat();

    await engine.sendMessage({ chatId: id, message: 'resize my photo' });

    expect(fetchImpl).toHaveBeenCalledOnce(); // no second round trip
    expect(events.at(-1)?.type).toBe('aiFinished');
  });
});
