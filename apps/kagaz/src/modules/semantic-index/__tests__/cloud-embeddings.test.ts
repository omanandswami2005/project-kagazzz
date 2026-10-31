import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudEmbeddingProvider } from '../providers/cloud-embedding.provider';

const reply = (embeddings: number[][]): Response => new Response(JSON.stringify({ embeddings }));

describe('CloudEmbeddingProvider', () => {
  it('posts texts and the kind to /api/ai/embed and returns vectors in order', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply([[1, 2], [3, 4]]));
    const out = await new CloudEmbeddingProvider(fetchImpl).embed(['a', 'b'], 'query');
    expect(out).toEqual([[1, 2], [3, 4]]);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ai/embed');
    expect(JSON.parse(init.body as string)).toEqual({ texts: ['a', 'b'], kind: 'query' });
  });

  it('defaults to document embeddings, skips the network for no input, and rejects a count mismatch', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(reply([[1]])));
    const provider = new CloudEmbeddingProvider(fetchImpl);
    await provider.embed(['a']);
    expect(JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string)).toMatchObject({ kind: 'document' });
    expect(await provider.embed([])).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    await expect(provider.embed(['a', 'b'])).rejects.toThrow('unexpected number');
  });
});

describe('getEmbeddingProvider follows the mode', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it('null with no config; Ollama when only a local server; Vertex when online', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLOUD_AI', '');
    vi.stubEnv('VITE_OLLAMA_URL', '');
    let mod = await import('../embedding-provider');
    expect(mod.getEmbeddingProvider()).toBeNull();

    vi.resetModules();
    vi.stubEnv('VITE_OLLAMA_URL', 'http://localhost:11434');
    mod = await import('../embedding-provider');
    expect(mod.getEmbeddingProvider()?.constructor.name).toBe('OllamaEmbeddingProvider');

    vi.resetModules();
    vi.stubEnv('VITE_CLOUD_AI', '1');
    const cloud = await import('@/infrastructure/cloud-ai');
    cloud.setAiMode('online');
    mod = await import('../embedding-provider');
    expect(mod.getEmbeddingProvider()?.constructor.name).toBe('CloudEmbeddingProvider');
  });
});
