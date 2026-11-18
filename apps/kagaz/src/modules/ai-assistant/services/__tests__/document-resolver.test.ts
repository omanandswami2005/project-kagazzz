import { describe, expect, it } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { resolveDocumentRef, type DocumentLookup } from '../document-resolver';

const doc = (id: string, name: string): DocumentEntity => ({ id, name }) as DocumentEntity;

const DOCS = [
  doc('u1', 'Rent Agreement 2024'),
  doc('u2', 'PAN Card'),
  doc('u3', 'Aadhaar Front'),
  doc('u4', 'Aadhaar Back'),
];

const lookup: DocumentLookup = {
  findById: async (id) => DOCS.find((d) => d.id === id) ?? null,
  findAll: async () => DOCS,
};

describe('resolveDocumentRef', () => {
  it('resolves an id', async () => {
    expect((await resolveDocumentRef(lookup, 'u2')).name).toBe('PAN Card');
  });

  it('resolves an exact name, ignoring case and extension', async () => {
    expect((await resolveDocumentRef(lookup, 'pan card.pdf')).id).toBe('u2');
  });

  it('resolves a partial name when only one document contains every word', async () => {
    expect((await resolveDocumentRef(lookup, 'rent agreement')).id).toBe('u1');
  });

  it('lists the candidate names (not ids) when several match', async () => {
    await expect(resolveDocumentRef(lookup, 'aadhaar')).rejects.toThrow(
      /"Aadhaar Front", "Aadhaar Back"/
    );
    await expect(resolveDocumentRef(lookup, 'aadhaar')).rejects.not.toThrow(/u3/);
  });

  it('points the model to search when nothing matches', async () => {
    await expect(resolveDocumentRef(lookup, 'passport')).rejects.toThrow(/ai\.searchDocuments/);
  });
});
