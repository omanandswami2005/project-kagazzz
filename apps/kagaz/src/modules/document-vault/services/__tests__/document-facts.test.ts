import { describe, expect, it } from 'vitest';
import { factsOf, readDocumentFacts, withFacts } from '../document-facts';

describe('document facts (metadata_json.facts)', () => {
  it('round-trips facts and keeps other metadata keys', () => {
    const json = withFacts(JSON.stringify({ origin: 'scan' }), { kind: 'pdf', pages: 5, title: 'Lease' });
    expect(JSON.parse(json)).toEqual({ origin: 'scan', facts: { kind: 'pdf', pages: 5, title: 'Lease' } });
    expect(factsOf({ metadataJson: json })).toEqual({ kind: 'pdf', pages: 5, title: 'Lease' });
  });

  it('reads nothing from missing, malformed or foreign metadata', () => {
    expect(factsOf({})).toBeNull();
    expect(factsOf({ metadataJson: '{not json' })).toBeNull();
    expect(factsOf({ metadataJson: JSON.stringify({ facts: { kind: 'video' } }) })).toBeNull();
    expect(withFacts('[1,2]', { kind: 'image', width: 2, height: 3 })).toBe(
      JSON.stringify({ facts: { kind: 'image', width: 2, height: 3 } })
    );
  });

  it('has no facts for types it does not read, and never throws', async () => {
    expect(await readDocumentFacts(new Blob(['x']), 'docx')).toBeNull();
    // jsdom has no createImageBitmap: the image path fails quietly.
    expect(await readDocumentFacts(new Blob(['x']), 'png')).toBeNull();
  });
});
