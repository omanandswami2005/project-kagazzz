import { describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { findInDocumentText, readDocumentText, searchTerms } from '../document-text.service';

const doc = (over: Partial<DocumentEntity>): DocumentEntity =>
  ({ id: 'd', name: 'Doc', isLocked: false, ocrText: '', ...over }) as DocumentEntity;

const card = doc({
  id: 'card',
  name: 'IMG_2041',
  ocrText: 'ROVER PETS CLUB  Member card  Mobile: 98765 43210  Valid till 2027',
});

describe('searchTerms', () => {
  it('drops filler words and keeps the distinctive keyword', () => {
    expect(searchTerms('mobile number of rover')).toEqual(['mobile number of rover', 'rover']);
  });
});

describe('findInDocumentText', () => {
  it('finds a document by a word inside its text (not its name) and returns a snippet', async () => {
    const search = vi.fn((term: string) => Promise.resolve(term === 'rover' ? [card] : []));
    const [hit] = await findInDocumentText({ search }, 'mobile number of rover', 5);
    expect(hit?.documentId).toBe('card');
    expect(hit?.snippet).toContain('98765 43210');
  });

  it('never returns locked documents', async () => {
    const locked = doc({ id: 'x', isLocked: true, ocrText: 'rover secret' });
    const matches = await findInDocumentText(
      { search: () => Promise.resolve([locked]) },
      'rover',
      5
    );
    expect(matches).toEqual([]);
  });

  it('ranks the document matching more terms first', async () => {
    const both = doc({ id: 'both', ocrText: 'rover pune' });
    const one = doc({ id: 'one', ocrText: 'rover' });
    const search = (term: string): Promise<DocumentEntity[]> =>
      Promise.resolve(term === 'rover' ? [one, both] : term === 'pune' ? [both] : []);
    const matches = await findInDocumentText({ search }, 'rover pune', 5);
    expect(matches.map((m) => m.documentId)).toEqual(['both', 'one']);
  });
});

describe('readDocumentText', () => {
  it('returns stored text without re-extracting', async () => {
    const extract = vi.fn();
    const out = await readDocumentText(card, extract);
    expect(out.text).toContain('Mobile');
    expect(extract).not.toHaveBeenCalled();
  });

  it('extracts when nothing is stored, and fails clearly when there is no text', async () => {
    const empty = doc({ ocrText: undefined });
    expect((await readDocumentText(empty, () => Promise.resolve('read now'))).text).toBe(
      'read now'
    );
    await expect(readDocumentText(empty, () => Promise.resolve(null))).rejects.toThrow(/No text/);
  });

  it('truncates very long text and says so', async () => {
    const long = doc({ ocrText: 'a'.repeat(9000) });
    const out = await readDocumentText(long, vi.fn());
    expect(out.text).toHaveLength(6000);
    expect(out.truncated).toBe(true);
  });
});
