import { beforeEach, describe, expect, it } from 'vitest';
import { decodeFromModel, encodeForModel, resetAliases } from '../document-alias';

const A = '1e905555-0455-4d45-a69c-caf3e5e5a3b3';
const B = '1111da0c-97db-4540-8d8f-12cd98c88a11';

beforeEach(resetAliases);

describe('document aliases (short ids for the model)', () => {
  it('replaces every uuid with a stable short alias, in any text', () => {
    const out = encodeForModel(`{"documents":[{"id":"${A}"},{"id":"${B}"}],"again":"${A}"}`);
    expect(out).toBe('{"documents":[{"id":"doc1"},{"id":"doc2"}],"again":"doc1"}');
    expect(out).not.toContain(A);
  });

  it('is case-insensitive about the same id', () => {
    expect(encodeForModel(`${A} ${A.toUpperCase()}`)).toBe('doc1 doc1');
  });

  it('maps aliases in tool arguments back to the real ids', () => {
    encodeForModel(`${A} ${B}`);
    expect(decodeFromModel('{"documentIds":["doc1","doc2"]}')).toBe(
      `{"documentIds":["${A}","${B}"]}`
    );
  });

  it('leaves unknown aliases and free text that merely looks like one untouched', () => {
    encodeForModel(A);
    expect(decodeFromModel('{"text":"doc1 copy","other":"doc9"}')).toBe(
      '{"text":"doc1 copy","other":"doc9"}'
    );
    expect(decodeFromModel('{"text":"doc1"}')).toBe(`{"text":"${A}"}`); // a whole-value alias is an id
  });

  it('passes a real uuid the model typed straight through', () => {
    expect(decodeFromModel(`{"documentId":"${A}"}`)).toBe(`{"documentId":"${A}"}`);
  });
});
