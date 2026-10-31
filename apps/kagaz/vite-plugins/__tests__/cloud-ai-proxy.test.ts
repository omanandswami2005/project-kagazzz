import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCloudProxyHandler, gcloudTokenProvider } from '../cloud-ai-proxy';

let server: Server | undefined;
afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

async function start(fetchImpl: typeof fetch, getToken = () => Promise.resolve('SECRET-TOKEN')): Promise<string> {
  const handler = createCloudProxyHandler({
    getToken,
    project: 'proj-1',
    chatModel: 'google/gemini-2.5-flash',
    embeddingModel: 'text-embedding-005',
    fetchImpl,
  });
  server = createServer((req, res) => {
    // mounted at /api/ai in vite: connect strips the prefix before the handler runs
    req.url = (req.url ?? '').replace(/^\/api\/ai/, '');
    void handler(req, res);
  });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ai`;
}

const json = { 'Content-Type': 'application/json' };

describe('cloud AI proxy', () => {
  it('health proves credentials work without returning them', async () => {
    const base = await start(vi.fn());
    const res = await fetch(`${base}/health`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toMatchObject({ ok: true, project: 'proj-1', chatModel: 'google/gemini-2.5-flash' });
    expect(text).not.toContain('SECRET-TOKEN');
  });

  it('health reports a clear failure when gcloud credentials are missing', async () => {
    const base = await start(vi.fn(), () => Promise.reject(new Error('gcloud failed — run: gcloud auth application-default login')));
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(502);
    expect(await res.text()).toContain('application-default login');
  });

  it('chat forwards to Vertex with the bearer token, pins the model, and streams the body back', async () => {
    const upstream = vi.fn().mockResolvedValue(
      new Response('data: {"a":1}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
    );
    const base = await start(upstream);
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ model: 'attacker/expensive-model', messages: [{ role: 'user', content: 'hi' }], stream: true }),
    });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(await res.text()).toContain('[DONE]');

    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://aiplatform.googleapis.com/v1/projects/proj-1/locations/global/endpoints/openapi/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SECRET-TOKEN');
    const sent = JSON.parse(init.body as string) as { model: string; stream: boolean };
    expect(sent.model).toBe('google/gemini-2.5-flash'); // the client's model was ignored
    expect(sent.stream).toBe(true);
  });

  it('embed batches 20 at a time, maps query/document task types, and returns vectors in order', async () => {
    const upstream = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const { instances } = JSON.parse(init.body as string) as { instances: { content: string }[] };
      return Promise.resolve(
        new Response(JSON.stringify({ predictions: instances.map((i) => ({ embeddings: { values: [Number(i.content)] } })) }))
      );
    });
    const base = await start(upstream);
    const texts = Array.from({ length: 45 }, (_, i) => String(i));
    const res = await fetch(`${base}/embed`, { method: 'POST', headers: json, body: JSON.stringify({ texts, kind: 'query' }) });
    const body = (await res.json()) as { embeddings: number[][] };

    expect(upstream).toHaveBeenCalledTimes(3); // 20 + 20 + 5
    expect(body.embeddings.map((v) => v[0])).toEqual(texts.map(Number));
    const first = JSON.parse((upstream.mock.calls[0] as [string, RequestInit])[1].body as string) as { instances: { task_type: string }[] };
    expect(first.instances[0].task_type).toBe('RETRIEVAL_QUERY');
  });

  it('embed rejects empty, oversized and non-string input; upstream failures become a 502 without the token', async () => {
    const base = await start(vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    for (const texts of [[], Array.from({ length: 257 }, () => 'x'), [1, 2]]) {
      const res = await fetch(`${base}/embed`, { method: 'POST', headers: json, body: JSON.stringify({ texts }) });
      expect(res.status).toBe(400);
    }
    const res = await fetch(`${base}/embed`, { method: 'POST', headers: json, body: JSON.stringify({ texts: ['a'] }) });
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).toContain('HTTP 500');
    expect(text).not.toContain('SECRET-TOKEN');
  });

  it('refuses cross-origin and non-JSON requests, and unknown routes', async () => {
    const upstream = vi.fn();
    const base = await start(upstream);
    const cross = await fetch(`${base}/chat`, { method: 'POST', headers: { ...json, Origin: 'https://evil.example' }, body: '{}' });
    expect(cross.status).toBe(403);
    const site = await fetch(`${base}/chat`, { method: 'POST', headers: { ...json, 'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
    expect(site.status).toBe(403);
    const plain = await fetch(`${base}/chat`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    expect(plain.status).toBe(415);
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe('gcloudTokenProvider', () => {
  it('caches the token instead of shelling out on every request', async () => {
    const run = vi.fn().mockResolvedValue('tok');
    const getToken = gcloudTokenProvider(run);
    await getToken();
    await getToken();
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(['auth', 'application-default', 'print-access-token']);
  });
});
