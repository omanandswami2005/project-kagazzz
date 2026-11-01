import { describe, expect, it, vi } from 'vitest';
import { InMemoryVectorStore, OllamaEmbeddingProvider, SemanticIndexService } from '..';
import { chunkText } from '../services/chunk-text';
import type { EmbeddingProvider } from '../types';

/** Deterministic fake: a text's vector is [has "cat", has "tax"]. */
const fakeEmbeddings: EmbeddingProvider = {
  embed: (texts) =>
    Promise.resolve(texts.map((t) => [t.includes('cat') ? 1 : 0, t.includes('tax') ? 1 : 0])),
};

describe('chunkText', () => {
  it('returns [] for blank text and one chunk for short text', () => {
    expect(chunkText('   ')).toEqual([]);
    expect(chunkText('hello  world')).toEqual(['hello world']);
  });

  it('splits long text into overlapping chunks that cover everything', () => {
    const text = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, 200, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 200)).toBe(true);
    expect(chunks[0]).toContain('word0');
    expect(chunks[chunks.length - 1]).toContain('word399');
  });
});

describe('SemanticIndexService', () => {
  it('finds the closest document and drops stale chunks on re-index', async () => {
    const service = new SemanticIndexService(fakeEmbeddings, new InMemoryVectorStore());
    await service.indexDocument('pets', 'my cat is called Tom');
    await service.indexDocument('itr', 'income tax return 2025');

    const [top] = await service.search('cat', 1);
    expect(top.chunk.documentId).toBe('pets');

    await service.indexDocument('pets', 'now about tax only');
    const [afterEdit] = await service.search('cat', 5);
    expect(afterEdit.score).toBe(0);
  });

  it('indexes nothing for empty text', async () => {
    const service = new SemanticIndexService(fakeEmbeddings, new InMemoryVectorStore());
    expect(await service.indexDocument('empty', '  ')).toBe(0);
  });
});

describe('OllamaEmbeddingProvider', () => {
  const make = (fetchImpl: typeof fetch) =>
    new OllamaEmbeddingProvider({ baseUrl: 'http://x', model: 'embeddinggemma', fetchImpl });

  it('posts a batch to /api/embed and returns the vectors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ embeddings: [[1, 2], [3, 4]] }),
    });
    const out = await make(fetchImpl).embed(['a', 'b']);
    expect(out).toEqual([[1, 2], [3, 4]]);
    expect(fetchImpl).toHaveBeenCalledWith('http://x/api/embed', expect.objectContaining({ method: 'POST' }));
  });

  it('throws on HTTP errors and on a vector-count mismatch', async () => {
    const bad = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(make(bad as unknown as typeof fetch).embed(['a'])).rejects.toThrow('HTTP 500');
    const short = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ embeddings: [] }) });
    await expect(make(short as unknown as typeof fetch).embed(['a'])).rejects.toThrow('unexpected');
  });
});
