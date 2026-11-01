import { describe, expect, it, vi } from 'vitest';
import { DocumentIndex, InMemoryVectorStore, SemanticIndexService, type EmbeddingProvider } from '..';

/** A text's vector is [mentions deposit, mentions electricity, mentions pan]. */
const embed = vi.fn((texts: string[]) =>
  Promise.resolve(texts.map((t) => [/deposit|rent/i.test(t) ? 1 : 0, /electric|units/i.test(t) ? 1 : 0, /pan|tax/i.test(t) ? 1 : 0]))
);
const provider: EmbeddingProvider = { embed };
const make = (): DocumentIndex => new DocumentIndex(new SemanticIndexService(provider, new InMemoryVectorStore()));

describe('DocumentIndex', () => {
  it('re-embeds only documents that are new or whose text changed', async () => {
    const index = make();
    embed.mockClear();
    expect(await index.sync([{ id: 'a', text: 'rent deposit 55,500' }, { id: 'b', text: 'electricity units 214' }])).toBe(2);
    expect(await index.sync([{ id: 'a', text: 'rent deposit 55,500' }, { id: 'b', text: 'electricity units 214' }])).toBe(0);
    expect(await index.sync([{ id: 'a', text: 'rent deposit 60,000' }])).toBe(1);
  });

  it('finds the document by meaning and returns its best passage once per document', async () => {
    const index = make();
    await index.sync([
      { id: 'rent', text: 'Rent agreement. Security deposit Rs 55,500. Monthly rent Rs 18,500.' },
      { id: 'bill', text: 'Electricity bill. Units consumed 214. Amount due Rs 1,830.' },
    ]);
    const hits = await index.search('how much is the deposit', 3);
    expect(hits[0].documentId).toBe('rent');
    expect(hits[0].passage).toContain('55,500');
    expect(new Set(hits.map((h) => h.documentId)).size).toBe(hits.length); // one hit per document
  });

  it('respects the limit and handles an empty index', async () => {
    const index = make();
    expect(await index.search('anything', 3)).toEqual([]);
    await index.sync([{ id: 'a', text: 'rent' }, { id: 'b', text: 'electricity' }, { id: 'c', text: 'pan tax' }]);
    expect(await index.search('rent', 2)).toHaveLength(2);
  });
});
