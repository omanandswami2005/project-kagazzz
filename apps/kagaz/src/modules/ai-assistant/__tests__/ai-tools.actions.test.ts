import { describe, expect, it, vi } from 'vitest';
import { aiToolActions, toDocumentSummary, type AiToolContext } from '../ai-tools.actions';
import type { DocumentEntity } from '@/infrastructure/database/types';

const document: DocumentEntity = {
  id: 'd-1',
  name: 'Passport Copy',
  description: undefined,
  filePath: '/vault/doc.pdf',
  fileType: 'pdf',
  fileSize: 1024,
  fileHash: undefined,
  thumbnailPath: undefined,
  folderId: undefined,
  isFavorite: true,
  isLocked: false,
  isArchived: false,
  language: 'en',
  ocrText: 'passport number 12345',
  sourceType: 'file_picker',
  originalFilename: undefined,
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
  lastAccessedAt: undefined,
  deletedAt: undefined,
  metadataJson: undefined,
  synced: false,
  version: 1,
};

describe('toDocumentSummary', () => {
  it('strips ocrText and filePath — [SEC] metadata-only AI boundary', () => {
    const summary = toDocumentSummary(document);
    expect(summary).toEqual({
      id: 'd-1',
      name: 'Passport Copy',
      fileType: 'pdf',
      fileSizeBytes: 1024,
      isFavorite: true,
      isLocked: false,
      createdAt: '2026-07-24T00:00:00.000Z',
    });
    expect(summary).not.toHaveProperty('ocrText');
    expect(summary).not.toHaveProperty('filePath');
  });
});

describe('aiToolActions.listDocuments', () => {
  it('forwards the requested limit and defaults to 20', async () => {
    const ctx: AiToolContext = {
      listDocuments: vi.fn().mockResolvedValue([toDocumentSummary(document)]),
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
      setTheme: vi.fn(),
      setLanguage: vi.fn(),
      setSwipeAction: vi.fn(),
    };
    const result = await aiToolActions.listDocuments.handler({ limit: 20 }, ctx);
    expect(ctx.listDocuments).toHaveBeenCalledWith(20);
    expect(result.documents).toHaveLength(1);
  });

  it('rejects a limit above the max via the registered Zod schema', () => {
    const parsed = aiToolActions.listDocuments.args.safeParse({ limit: 999 });
    expect(parsed.success).toBe(false);
  });
});

describe('aiToolActions.searchDocuments', () => {
  it('forwards the raw query and limit to the context', async () => {
    const ctx: AiToolContext = {
      listDocuments: vi.fn(),
      searchDocuments: vi.fn().mockResolvedValue([toDocumentSummary(document)]),
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
      setTheme: vi.fn(),
      setLanguage: vi.fn(),
      setSwipeAction: vi.fn(),
    };
    const result = await aiToolActions.searchDocuments.handler({ query: 'passport', limit: 10 }, ctx);
    expect(ctx.searchDocuments).toHaveBeenCalledWith('passport', 10);
    expect(result.documents[0]?.name).toBe('Passport Copy');
  });

  it('rejects an empty query via the registered Zod schema', () => {
    const parsed = aiToolActions.searchDocuments.args.safeParse({ query: '', limit: 10 });
    expect(parsed.success).toBe(false);
  });
});
