import { describe, expect, it, vi } from 'vitest';
import { aiNavigationActions } from '../ai-navigation.actions';
import type { AiToolContext } from '../ai-tools.actions';

function makeCtx(): AiToolContext {
  return {
    listDocuments: vi.fn(),
    searchDocuments: vi.fn(),
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
    semanticSearch: vi.fn(),
    setTheme: vi.fn(),
    setLanguage: vi.fn(),
    setSwipeAction: vi.fn(),
  };
}

describe('aiNavigationActions (F-23)', () => {
  it('openQuickReference calls ctx.openQuickReference and acks', async () => {
    const ctx = makeCtx();
    const result = await aiNavigationActions.openQuickReference.handler({}, ctx);
    expect(ctx.openQuickReference).toHaveBeenCalledOnce();
    expect(result).toEqual({ opened: true });
  });

  it('openQuickNotes calls ctx.openQuickNotes and acks', async () => {
    const ctx = makeCtx();
    const result = await aiNavigationActions.openQuickNotes.handler({}, ctx);
    expect(ctx.openQuickNotes).toHaveBeenCalledOnce();
    expect(result).toEqual({ opened: true });
  });

  it('startQuickNote calls ctx.startQuickNote and acks', async () => {
    const ctx = makeCtx();
    const result = await aiNavigationActions.startQuickNote.handler({}, ctx);
    expect(ctx.startQuickNote).toHaveBeenCalledOnce();
    expect(result).toEqual({ opened: true });
  });

  it('openSettings calls ctx.openSettings and acks', async () => {
    const ctx = makeCtx();
    const result = await aiNavigationActions.openSettings.handler({}, ctx);
    expect(ctx.openSettings).toHaveBeenCalledOnce();
    expect(result).toEqual({ opened: true });
  });

  it('openPdfTools calls ctx.openPdfTools and acks', async () => {
    const ctx = makeCtx();
    const result = await aiNavigationActions.openPdfTools.handler({}, ctx);
    expect(ctx.openPdfTools).toHaveBeenCalledOnce();
    expect(result).toEqual({ opened: true });
  });

  it('all five reuse their module id and are never requiresConfirmation', () => {
    const ids = Object.values(aiNavigationActions).map((action) => action.id);
    expect(ids).toEqual([
      'vault.openQuickReference',
      'vault.openQuickNotes',
      'vault.startQuickNote',
      'settings.open',
      'tools.openPdfTools',
    ]);
    expect(Object.values(aiNavigationActions).every((action) => !action.requiresConfirmation)).toBe(
      true
    );
  });
});
