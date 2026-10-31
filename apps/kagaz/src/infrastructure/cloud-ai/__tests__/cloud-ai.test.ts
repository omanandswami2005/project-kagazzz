import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAiMode, isOnline, onAiModeChange, setAiMode } from '../ai-mode';
import { cloudChatStream, cloudHealth, cloudPost } from '../cloud-ai-http';

describe('ai-mode (the single online/offline switch)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_CLOUD_AI', '1');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to offline, persists the choice, and notifies subscribers', () => {
    expect(getAiMode()).toBe('offline');
    const seen: string[] = [];
    const off = onAiModeChange((m) => seen.push(m));
    setAiMode('online');
    expect(getAiMode()).toBe('online');
    expect(isOnline()).toBe(true);
    off();
    setAiMode('offline');
    expect(seen).toEqual(['online']);
  });

  it('stays offline whatever is stored when the build has no cloud proxy', () => {
    setAiMode('online');
    vi.stubEnv('VITE_CLOUD_AI', '');
    expect(getAiMode()).toBe('offline');
  });
});

const sse = (...events: string[]): Response => new Response(events.map((e) => `data: ${e}\n\n`).join(''));

describe('cloud-ai-http', () => {
  it('cloudHealth and cloudPost return JSON and turn failures into readable errors', async () => {
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, project: 'p' })));
    expect((await cloudHealth(ok as unknown as typeof fetch)).project).toBe('p');

    const fail = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: 'gcloud failed' }), { status: 502 })));
    await expect(cloudPost('/embed', {}, fail as unknown as typeof fetch)).rejects.toThrow('gcloud failed');
    await expect(cloudHealth(fail as unknown as typeof fetch)).rejects.toThrow('gcloud failed');
  });

  it('cloudChatStream yields each chunk until [DONE], forcing stream:true', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(sse('{"n":1}', '{"n":2}', '[DONE]', '{"n":3}'));
    const seen: unknown[] = [];
    for await (const chunk of cloudChatStream({ messages: [] }, fetchImpl as unknown as typeof fetch)) {
      seen.push(chunk);
    }
    expect(seen).toEqual([{ n: 1 }, { n: 2 }]);
    expect(JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string)).toMatchObject({ stream: true });
  });

  it('cloudChatStream handles events split across network chunks', async () => {
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"a"'));
          controller.enqueue(encoder.encode(':1}\n\ndata: [DONE]\n\n'));
          controller.close();
        },
      })
    );
    const out: unknown[] = [];
    for await (const chunk of cloudChatStream({}, vi.fn().mockResolvedValue(response) as unknown as typeof fetch)) {
      out.push(chunk);
    }
    expect(out).toEqual([{ a: 1 }]);
  });
});
