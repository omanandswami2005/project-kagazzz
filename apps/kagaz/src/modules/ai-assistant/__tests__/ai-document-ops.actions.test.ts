import { describe, expect, it, vi } from 'vitest';
import { aiDocumentOpsActions } from '../ai-document-ops.actions';
import type { AiToolContext } from '../ai-tools.actions';

function makeCtx(overrides: Partial<AiToolContext> = {}): AiToolContext {
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
    setTheme: vi.fn(),
    setLanguage: vi.fn(),
    setSwipeAction: vi.fn(),
    ...overrides,
  };
}

describe('aiDocumentOpsActions (F-14 document operations)', () => {
  it('mergeDocuments forwards ids and reports the created count', async () => {
    const mergeDocuments = vi.fn().mockResolvedValue({ created: 1, documents: [] });
    const ctx = makeCtx({ mergeDocuments });
    const result = await aiDocumentOpsActions.mergeDocuments.handler(
      { documentIds: ['a', 'b'] },
      ctx
    );
    expect(mergeDocuments).toHaveBeenCalledWith(['a', 'b']);
    expect(result).toEqual({ created: 1, documents: [] });
  });

  it('mergeDocuments rejects fewer than 2 ids via the registered Zod schema', () => {
    const parsed = aiDocumentOpsActions.mergeDocuments.args.safeParse({ documentIds: ['a'] });
    expect(parsed.success).toBe(false);
  });

  it('splitDocument forwards the document id and ranges', async () => {
    const splitDocument = vi.fn().mockResolvedValue({ created: 2, documents: [] });
    const ctx = makeCtx({ splitDocument });
    const result = await aiDocumentOpsActions.splitDocument.handler(
      { documentId: 'd-1', ranges: [{ start: 1, end: 3 }] },
      ctx
    );
    expect(splitDocument).toHaveBeenCalledWith('d-1', [{ start: 1, end: 3 }]);
    expect(result).toEqual({ created: 2, documents: [] });
  });

  it('splitDocument rejects an empty ranges array', () => {
    const parsed = aiDocumentOpsActions.splitDocument.args.safeParse({ documentId: 'd-1', ranges: [] });
    expect(parsed.success).toBe(false);
  });

  it('compressDocument defaults quality to medium', () => {
    const parsed = aiDocumentOpsActions.compressDocument.args.safeParse({ documentId: 'd-1' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.quality).toBe('medium');
  });

  it('compressDocument forwards the requested quality', async () => {
    const compressDocument = vi.fn().mockResolvedValue({ created: 1, documents: [] });
    const ctx = makeCtx({ compressDocument });
    const result = await aiDocumentOpsActions.compressDocument.handler(
      { documentId: 'd-1', quality: 'low' },
      ctx
    );
    expect(compressDocument).toHaveBeenCalledWith('d-1', 'low');
    expect(result).toEqual({ created: 1, documents: [] });
  });

  it('watermarkDocument forwards the id and text', async () => {
    const watermarkDocument = vi.fn().mockResolvedValue({ created: 1, documents: [] });
    const ctx = makeCtx({ watermarkDocument });
    const result = await aiDocumentOpsActions.watermarkDocument.handler(
      { documentId: 'd-1', text: 'DRAFT' },
      ctx
    );
    expect(watermarkDocument).toHaveBeenCalledWith('d-1', 'DRAFT');
    expect(result).toEqual({ created: 1, documents: [] });
  });

  it('watermarkDocument rejects an empty watermark text', () => {
    const parsed = aiDocumentOpsActions.watermarkDocument.args.safeParse({ documentId: 'd-1', text: '' });
    expect(parsed.success).toBe(false);
  });

  it('convertImagesToPdf forwards the image ids', async () => {
    const convertImagesToPdf = vi.fn().mockResolvedValue({ created: 1, documents: [] });
    const ctx = makeCtx({ convertImagesToPdf });
    const result = await aiDocumentOpsActions.convertImagesToPdf.handler(
      { documentIds: ['img-1', 'img-2'] },
      ctx
    );
    expect(convertImagesToPdf).toHaveBeenCalledWith(['img-1', 'img-2']);
    expect(result).toEqual({ created: 1, documents: [] });
  });

  it('convertPdfToImages defaults format to jpeg and forwards it', async () => {
    const parsed = aiDocumentOpsActions.convertPdfToImages.args.safeParse({ documentId: 'd-1' });
    expect(parsed.success && parsed.data.format).toBe('jpeg');

    const convertPdfToImages = vi.fn().mockResolvedValue({ created: 3, documents: [] });
    const ctx = makeCtx({ convertPdfToImages });
    const result = await aiDocumentOpsActions.convertPdfToImages.handler(
      { documentId: 'd-1', format: 'png' },
      ctx
    );
    expect(convertPdfToImages).toHaveBeenCalledWith('d-1', 'png');
    expect(result).toEqual({ created: 3, documents: [] });
  });

  it('exportPdfText defaults format to txt and forwards it', async () => {
    const parsed = aiDocumentOpsActions.exportPdfText.args.safeParse({ documentId: 'd-1' });
    expect(parsed.success && parsed.data.format).toBe('txt');

    const exportPdfText = vi.fn().mockResolvedValue({ created: 1, documents: [] });
    const ctx = makeCtx({ exportPdfText });
    const result = await aiDocumentOpsActions.exportPdfText.handler(
      { documentId: 'd-1', format: 'md' },
      ctx
    );
    expect(exportPdfText).toHaveBeenCalledWith('d-1', 'md');
    expect(result).toEqual({ created: 1, documents: [] });
  });

  it('all seven are non-destructive per the reclassified security policy', () => {
    expect(Object.values(aiDocumentOpsActions).every((action) => !action.requiresConfirmation)).toBe(
      true
    );
  });
});
