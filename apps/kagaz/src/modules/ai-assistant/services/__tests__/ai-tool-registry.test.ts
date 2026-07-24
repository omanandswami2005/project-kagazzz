import { describe, expect, it } from 'vitest';
import { AI_TOOL_DESCRIPTORS, aiToolRegistry } from '../ai-tool-registry';
import type { AiToolContext } from '../../ai-tools.actions';

describe('aiToolRegistry', () => {
  it('registers both AI tool actions', () => {
    expect(aiToolRegistry.has('ai.listDocuments')).toBe(true);
    expect(aiToolRegistry.has('ai.searchDocuments')).toBe(true);
  });

  it('invokes a registered action end-to-end via the real ActionResult envelope', async () => {
    const ctx: AiToolContext = {
      listDocuments: async () => [],
      searchDocuments: async () => [],
    };
    const result = await aiToolRegistry.invoke('ai.listDocuments', { limit: 5 }, ctx);
    expect(result).toEqual({ ok: true, data: { documents: [] } });
  });
});

describe('AI_TOOL_DESCRIPTORS', () => {
  it('exposes each action under its own dotted id, not the underscored OpenAI name', () => {
    const names = AI_TOOL_DESCRIPTORS.map((d) => d.name);
    expect(names).toContain('ai.listDocuments');
    expect(names).toContain('ai.searchDocuments');
  });

  it('serializes descriptionJson with the matching dotted name', () => {
    const listDocuments = AI_TOOL_DESCRIPTORS.find((d) => d.name === 'ai.listDocuments');
    const description = JSON.parse(listDocuments?.descriptionJson ?? '{}') as { name: string };
    expect(description.name).toBe('ai.listDocuments');
  });
});
