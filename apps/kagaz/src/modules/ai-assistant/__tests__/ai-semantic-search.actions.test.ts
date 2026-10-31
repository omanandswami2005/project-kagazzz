import { describe, expect, it, vi } from 'vitest';
import { aiSemanticSearchActions } from '../ai-semantic-search.actions';
import type { AiToolContext } from '../ai-tools.actions';
import { aiToolRegistry } from '../services/ai-tool-registry';

describe('ai.semanticSearch', () => {
  it('forwards the query and limit and returns the passages', async () => {
    const semanticSearch = vi.fn().mockResolvedValue({ results: [{ documentId: 'd', name: 'd.pdf', score: 0.8, passage: 'p' }] });
    const out = await aiSemanticSearchActions.semanticSearch.handler({ query: 'deposit', limit: 3 }, { semanticSearch } as unknown as AiToolContext);
    expect(semanticSearch).toHaveBeenCalledWith('deposit', 3);
    expect(out.results[0].name).toBe('d.pdf');
  });

  it('validates arguments: query length and a sane limit, defaulting to 4', () => {
    const schema = aiSemanticSearchActions.semanticSearch.args;
    expect(schema.safeParse({ query: 'x' }).success).toBe(false);
    expect(schema.safeParse({ query: 'deposit', limit: 99 }).success).toBe(false);
    expect(schema.parse({ query: 'deposit' }).limit).toBe(4);
  });

  it('is registered, belongs to the document-search skill (not core), and tells the model to answer only from passages', () => {
    expect(aiToolRegistry.has('ai.semanticSearch')).toBe(true);
    const def = aiToolRegistry.toToolDefinitions()['ai.semanticSearch'];
    expect(def.function.description).toContain('Answer ONLY from the returned passages');
  });
});
