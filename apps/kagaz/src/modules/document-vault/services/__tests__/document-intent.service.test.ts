import { describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';
import {
  openDocumentWith,
  outgoingFileName,
  shareDocument,
  shareDocuments,
  type DocumentIntentDeps,
} from '../document-intent.service';

const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({ id: 'd1', name: 'PAN Card', filePath: 'documents/d1.pdf', fileType: 'pdf', ...over }) as DocumentEntity;

function deps(over: Partial<DocumentIntentDeps> = {}): DocumentIntentDeps {
  return {
    getUri: vi.fn(async (p: string) => `file:///data/${p}`),
    copy: vi.fn(async () => undefined),
    newId: () => 'x',
    share: vi.fn(async () => undefined),
    openFile: vi.fn(async () => undefined),
    ...over,
  };
}

describe('shareDocument (F-65)', () => {
  it('shares a copy named after the document, not the stored uuid file', async () => {
    const d = deps();
    await shareDocument(doc(), d);
    expect(d.copy).toHaveBeenCalledWith('documents/d1.pdf', 'temp/share-x/PAN Card.pdf');
    expect(d.share).toHaveBeenCalledWith({
      title: 'PAN Card',
      url: 'file:///data/temp/share-x/PAN Card.pdf',
    });
  });
});

describe('shareDocuments (F-65 bulk-select)', () => {
  it('is a no-op for an empty selection', async () => {
    const d = deps();
    await shareDocuments([], d);
    expect(d.getUri).not.toHaveBeenCalled();
    expect(d.share).not.toHaveBeenCalled();
  });

  it('delegates a single document to the plain url shape', async () => {
    const d = deps();
    await shareDocuments([doc()], d);
    expect(d.share).toHaveBeenCalledWith({
      title: 'PAN Card',
      url: 'file:///data/temp/share-x/PAN Card.pdf',
    });
  });

  it('shares multiple documents in one call via the files array', async () => {
    const d = deps();
    const second = doc({ id: 'd2', name: 'Aadhaar', filePath: 'documents/d2.jpg', fileType: 'jpg' });
    await shareDocuments([doc(), second], d);
    expect(d.share).toHaveBeenCalledWith({
      title: 'PAN Card, Aadhaar',
      files: ['file:///data/temp/share-x/PAN Card.pdf', 'file:///data/temp/share-x/Aadhaar.jpg'],
    });
  });

  it('de-duplicates two documents with the same name', async () => {
    const d = deps();
    await shareDocuments([doc(), doc({ id: 'd2', filePath: 'documents/d2.pdf' })], d);
    expect(d.share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ['file:///data/temp/share-x/PAN Card.pdf', 'file:///data/temp/share-x/PAN Card (2).pdf'],
      })
    );
  });
});

describe('openDocumentWith (F-64)', () => {
  it('opens via the chooser with the right MIME and openWithDefault:false', async () => {
    const d = deps();
    await openDocumentWith(doc(), d);
    expect(d.openFile).toHaveBeenCalledWith({
      filePath: 'file:///data/temp/share-x/PAN Card.pdf',
      contentType: 'application/pdf',
      openWithDefault: false,
    });
  });

  it('maps the content type from the stored fileType', async () => {
    const d = deps();
    await openDocumentWith(doc({ filePath: 'documents/d2.jpg', fileType: 'jpg' }), d);
    expect(d.openFile).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/jpeg', openWithDefault: false })
    );
  });

  it('falls back to octet-stream for an unknown type', async () => {
    const d = deps();
    await openDocumentWith(doc({ fileType: 'xyz' }), d);
    expect(d.openFile).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'application/octet-stream' })
    );
  });
});

describe('outgoingFileName', () => {
  it('strips characters receivers reject', () => {
    expect(outgoingFileName({ name: 'Bill: 2024/25?', fileType: 'pdf' })).toBe('Bill_ 2024_25_.pdf');
  });

  it('does not double the extension', () => {
    expect(outgoingFileName({ name: 'scan.PDF', fileType: 'pdf' })).toBe('scan.pdf');
  });

  it('falls back to "document" for an empty name', () => {
    expect(outgoingFileName({ name: '  ', fileType: 'jpg' })).toBe('document.jpg');
  });
});
