import { describe, expect, it, vi } from 'vitest';
import { AI_TOOL_DESCRIPTORS, aiToolRegistry } from '../ai-tool-registry';
import type { AiToolContext } from '../../ai-tools.actions';

describe('aiToolRegistry', () => {
  it('registers both document AI tool actions', () => {
    expect(aiToolRegistry.has('ai.listDocuments')).toBe(true);
    expect(aiToolRegistry.has('ai.searchDocuments')).toBe(true);
  });

  it('registers all five F-23 navigation tools', () => {
    expect(aiToolRegistry.has('vault.openQuickReference')).toBe(true);
    expect(aiToolRegistry.has('vault.openQuickNotes')).toBe(true);
    expect(aiToolRegistry.has('vault.startQuickNote')).toBe(true);
    expect(aiToolRegistry.has('settings.open')).toBe(true);
    expect(aiToolRegistry.has('tools.openPdfTools')).toBe(true);
  });

  it('registers all seven F-14 document-operation tools', () => {
    expect(aiToolRegistry.has('ai.mergeDocuments')).toBe(true);
    expect(aiToolRegistry.has('ai.splitDocument')).toBe(true);
    expect(aiToolRegistry.has('ai.compressDocument')).toBe(true);
    expect(aiToolRegistry.has('ai.watermarkDocument')).toBe(true);
    expect(aiToolRegistry.has('ai.convertImagesToPdf')).toBe(true);
    expect(aiToolRegistry.has('ai.convertPdfToImages')).toBe(true);
    expect(aiToolRegistry.has('ai.exportPdfText')).toBe(true);
  });

  it('registers all three settings tools (bug-audit fix — used to not be registered at all)', () => {
    expect(aiToolRegistry.has('settings.setTheme')).toBe(true);
    expect(aiToolRegistry.has('settings.setLanguage')).toBe(true);
    expect(aiToolRegistry.has('settings.setSwipeAction')).toBe(true);
  });

  it('invokes a registered action end-to-end via the real ActionResult envelope', async () => {
    const ctx: AiToolContext = {
      listDocuments: async () => [],
      searchDocuments: async () => [],
      openQuickReference: vi.fn(),
      openQuickNotes: vi.fn(),
      startQuickNote: vi.fn(),
      openSettings: vi.fn(),
      openPdfTools: vi.fn(),
      mergeDocuments: vi.fn(),
      splitDocument: vi.fn(),
      compressDocument: vi.fn(),
      watermarkDocument: vi.fn(),
      convertImagesToPdf: vi.fn(),
      convertPdfToImages: vi.fn(),
      exportPdfText: vi.fn(),
      resizeImage: vi.fn(),
      enhanceImage: vi.fn(),
      runOcr: vi.fn(),
      loadSkill: vi.fn(),
      askUser: vi.fn(),
      setTheme: vi.fn(),
      setLanguage: vi.fn(),
      setSwipeAction: vi.fn(),
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
