import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const index = vi.hoisted(() => ({ sync: vi.fn(), search: vi.fn() }));
const active = vi.hoisted(() => ({ value: true }));
vi.mock('@/modules/semantic-index', () => ({
  getDocumentIndex: () => (active.value ? { backend: 'ollama', index } : null),
}));

import { semanticSearchDocuments } from '../document-search.service';

const doc = (id: string, over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({ id, name: `${id}.pdf`, fileType: 'pdf', isLocked: false, ...over }) as DocumentEntity;

beforeEach(() => {
  active.value = true;
  index.sync.mockReset().mockResolvedValue(0);
  index.search.mockReset().mockResolvedValue([]);
});

describe('semanticSearchDocuments', () => {
  it('fails clearly when the build has no embedding backend', async () => {
    active.value = false;
    await expect(
      semanticSearchDocuments({ listDocuments: () => Promise.resolve([]), extractText: vi.fn() }, 'deposit', 3)
    ).rejects.toThrow('no embedding backend');
  });

  it('reads documents that have no text with the vision model, indexes everything, and maps hits to names', async () => {
    const extractText = vi.fn().mockResolvedValue('Security deposit Rs 55,500');
    index.sync.mockResolvedValue(2);
    index.search.mockResolvedValue([{ documentId: 'rent', score: 0.81234, passage: 'x'.repeat(900) }]);

    const out = await semanticSearchDocuments(
      { listDocuments: () => Promise.resolve([doc('rent'), doc('bill', { ocrText: 'Units consumed 214' })]), extractText },
      'how much is the deposit',
      3
    );

    expect(extractText).toHaveBeenCalledOnce(); // only the document without stored text
    expect(extractText).toHaveBeenCalledWith(expect.objectContaining({ id: 'rent' }));
    expect(index.sync).toHaveBeenCalledWith([
      { id: 'rent', text: 'Security deposit Rs 55,500' },
      { id: 'bill', text: 'Units consumed 214' },
    ]);
    expect(out).toMatchObject({ backend: 'ollama', indexed: 2, transcribed: 1, unreadRemaining: 0 });
    expect(out.results).toEqual([{ documentId: 'rent', name: 'rent.pdf', score: 0.812, passage: 'x'.repeat(500) }]);
  });

  it('never reads, indexes or returns a locked document', async () => {
    const extractText = vi.fn().mockResolvedValue('secret');
    index.search.mockResolvedValue([{ documentId: 'vault', score: 0.9, passage: 'secret' }]);
    const out = await semanticSearchDocuments(
      { listDocuments: () => Promise.resolve([doc('vault', { isLocked: true, ocrText: 'secret' })]), extractText },
      'anything',
      3
    );
    expect(extractText).not.toHaveBeenCalled();
    expect(index.sync).toHaveBeenCalledWith([]);
    expect(out.results).toEqual([]); // even if the index somehow returned it
  });

  it('caps how many documents one search reads, and reports the rest', async () => {
    const extractText = vi.fn().mockResolvedValue('text');
    const docs = ['a', 'b', 'c', 'd', 'e'].map((id) => doc(id));
    const out = await semanticSearchDocuments({ listDocuments: () => Promise.resolve(docs), extractText, maxTranscribe: 2 }, 'q', 3);
    expect(extractText).toHaveBeenCalledTimes(2);
    expect(out).toMatchObject({ transcribed: 2, unreadRemaining: 3 });
  });

  it('skips documents whose text cannot be read instead of failing the search', async () => {
    const extractText = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('  ');
    await semanticSearchDocuments({ listDocuments: () => Promise.resolve([doc('a'), doc('b')]), extractText }, 'q', 3);
    expect(index.sync).toHaveBeenCalledWith([]);
  });
});
