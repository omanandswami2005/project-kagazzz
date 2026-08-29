import { describe, expect, it, vi } from 'vitest';
import { aiSettingsActions } from '../ai-settings.actions';
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
    setTheme: vi.fn(),
    setLanguage: vi.fn(),
    setSwipeAction: vi.fn(),
  };
}

describe('aiSettingsActions (bug-audit fix — these used to not be registered anywhere)', () => {
  it('setTheme calls ctx.setTheme and acks', async () => {
    const ctx = makeCtx();
    const result = await aiSettingsActions.setTheme.handler({ theme: 'dark' }, ctx);
    expect(ctx.setTheme).toHaveBeenCalledWith('dark');
    expect(result).toEqual({ theme: 'dark' });
  });

  it('setLanguage calls ctx.setLanguage and acks', async () => {
    const ctx = makeCtx();
    const result = await aiSettingsActions.setLanguage.handler({ language: 'hi' }, ctx);
    expect(ctx.setLanguage).toHaveBeenCalledWith('hi');
    expect(result).toEqual({ language: 'hi' });
  });

  it('setSwipeAction calls ctx.setSwipeAction and acks', async () => {
    const ctx = makeCtx();
    const result = await aiSettingsActions.setSwipeAction.handler(
      { side: 'left', action: 'archive' },
      ctx
    );
    expect(ctx.setSwipeAction).toHaveBeenCalledWith('left', 'archive');
    expect(result).toEqual({ side: 'left', action: 'archive' });
  });

  it('reuses the real settings.actions.ts ids (settings.open excluded — already in ai-navigation.actions.ts) and are never requiresConfirmation', () => {
    const ids = Object.values(aiSettingsActions).map((action) => action.id);
    expect(ids).toEqual(['settings.setTheme', 'settings.setLanguage', 'settings.setSwipeAction']);
    expect(Object.values(aiSettingsActions).every((action) => !action.requiresConfirmation)).toBe(
      true
    );
  });
});
