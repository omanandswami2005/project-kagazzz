import { describe, expect, it, vi } from 'vitest';
import { ollamaGet, ollamaPost, ollamaStream } from '../ollama-http';

function streamOf(...chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
        controller.close();
      },
    })
  );
}

describe('ollama-http', () => {
  it('ollamaPost sends JSON and returns the parsed body; ollamaGet reads JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 })));
    expect(await ollamaPost('http://x', '/api/embed', { a: 1 }, fetchImpl as unknown as typeof fetch)).toEqual({ ok: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://x/api/embed');
    expect(init.body).toBe('{"a":1}');

    const getFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [] })));
    expect(await ollamaGet('http://x', '/api/tags', getFetch as unknown as typeof fetch)).toEqual({ models: [] });
  });

  it('throws a clear error on an HTTP failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('no', { status: 500 }));
    await expect(ollamaPost('http://x', '/api/chat', {}, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      'POST /api/chat failed: HTTP 500'
    );
  });

  it('ollamaStream yields each NDJSON object even when lines are split across chunks', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(streamOf('{"n":1}\n{"n"', ':2}\n', '{"n":3}'));
    const seen: unknown[] = [];
    for await (const obj of ollamaStream('http://x', '/api/chat', {}, fetchImpl as unknown as typeof fetch)) {
      seen.push(obj);
    }
    expect(seen).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });
});
