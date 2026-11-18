import { describe, expect, it } from 'vitest';
import { splitByDocNames } from '../doc-mentions';

const pan = { id: 'p', name: 'PAN Card' };
const panBack = { id: 'pb', name: 'PAN Card back' };
const merged = { id: 'm', name: 'Merged document' };

describe('splitByDocNames', () => {
  it('links a name case-insensitively, with an optional extension', () => {
    expect(splitByDocNames('I saved merged document.pdf for you.', [merged])).toEqual([
      'I saved ',
      { doc: merged, text: 'merged document.pdf' },
      ' for you.',
    ]);
  });

  it('prefers the longest matching name', () => {
    const out = splitByDocNames('See PAN Card back.', [pan, panBack]);
    expect(out[1]).toEqual({ doc: panBack, text: 'PAN Card back' });
  });

  it('only matches whole words', () => {
    expect(splitByDocNames('EXPANSION', [{ id: 'x', name: 'pan' }])).toEqual(['EXPANSION']);
  });

  it('skips names too short to be meaningful', () => {
    expect(splitByDocNames('ID is ready', [{ id: 'i', name: 'ID' }])).toEqual(['ID is ready']);
  });

  it('returns the text as one run when nothing matches', () => {
    expect(splitByDocNames('Hello', [pan])).toEqual(['Hello']);
    expect(splitByDocNames('', [pan])).toEqual([]);
  });
});
