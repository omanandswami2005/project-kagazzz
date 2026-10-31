import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCloudVisionRecognizer, createOllamaVisionRecognizer } from '../vision-ocr.service';

function fetchReturning(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
}

describe('createOllamaVisionRecognizer', () => {
  it('posts the image as base64 to /api/chat and returns the trimmed transcription', async () => {
    const fetchImpl = fetchReturning({ message: { content: '  PAN ABCDE1234F \n' } });
    const recognize = createOllamaVisionRecognizer({ baseUrl: 'http://x', model: 'gemma4:e2b', fetchImpl });

    const text = await recognize(new Blob([new Uint8Array([1, 2, 3])]));

    expect(text).toBe('PAN ABCDE1234F');
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe('http://x/api/chat');
    const sent = JSON.parse(init?.body as string) as {
      model: string;
      stream: boolean;
      messages: { images: string[] }[];
    };
    expect(sent.model).toBe('gemma4:e2b');
    expect(sent.stream).toBe(false);
    expect(sent.messages[0].images).toEqual([btoa(String.fromCharCode(1, 2, 3))]);
  });

  it('returns an empty string when the model says nothing', async () => {
    const recognize = createOllamaVisionRecognizer({
      baseUrl: 'http://x',
      model: 'm',
      fetchImpl: fetchReturning({}),
    });
    expect(await recognize(new Blob(['x']))).toBe('');
  });

  it('throws on an HTTP error', async () => {
    const recognize = createOllamaVisionRecognizer({
      baseUrl: 'http://x',
      model: 'm',
      fetchImpl: fetchReturning({}, false, 503),
    });
    await expect(recognize(new Blob(['x']))).rejects.toThrow('HTTP 503');
  });
});

describe('createCloudVisionRecognizer (online mode)', () => {
  it('sends the image as a data URL to the proxy and returns the trimmed transcription', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '  PAN ABCDE1234F \n' } }] })));
    const recognize = createCloudVisionRecognizer(fetchImpl);

    const text = await recognize(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));

    expect(text).toBe('PAN ABCDE1234F');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ai/chat');
    const body = JSON.parse(init.body as string) as { messages: { content: { type: string; image_url?: { url: string } }[] }[] };
    const image = body.messages[0].content.find((p) => p.type === 'image_url');
    expect(image?.image_url?.url).toBe(`data:image/png;base64,${btoa(String.fromCharCode(1, 2, 3))}`);
  });

  it('returns an empty string when the model says nothing, and surfaces a proxy failure', async () => {
    const empty = createCloudVisionRecognizer(vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }))));
    expect(await empty(new Blob(['x']))).toBe('');
    const failing = createCloudVisionRecognizer(
      vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: 'gcloud failed' }), { status: 502 })))
    );
    await expect(failing(new Blob(['x']))).rejects.toThrow('gcloud failed');
  });
});

describe('getConfiguredVisionRecognizer follows the mode', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is null with no demo config; Gemini when online; Ollama when only a local server is configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLOUD_AI', '');
    vi.stubEnv('VITE_OLLAMA_URL', '');
    localStorage.clear();
    let svc = await import('../vision-ocr.service');
    expect(svc.getConfiguredVisionRecognizer()).toBeNull();

    vi.resetModules();
    vi.stubEnv('VITE_OLLAMA_URL', 'http://localhost:11434');
    svc = await import('../vision-ocr.service');
    expect(svc.getConfiguredVisionRecognizer()).not.toBeNull();

    vi.resetModules();
    vi.stubEnv('VITE_CLOUD_AI', '1');
    const mode = await import('@/infrastructure/cloud-ai');
    mode.setAiMode('online');
    svc = await import('../vision-ocr.service');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'from cloud' } }] })));
    expect(await svc.getConfiguredVisionRecognizer()?.(new Blob(['x']))).toBe('from cloud');
    expect((fetchSpy.mock.calls[0] as [string])[0]).toBe('/api/ai/chat');
    fetchSpy.mockRestore();
  });
});
