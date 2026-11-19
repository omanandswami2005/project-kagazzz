import { describe, expect, it } from 'vitest';
import { offerQuickReferenceDraft, takeQuickReferenceDraft } from '../quick-reference-draft';

describe('quick-reference draft hand-off (QN-2, VW-9)', () => {
  it('is taken once, then gone', () => {
    offerQuickReferenceDraft({ label: 'PAN No', value: 'ABCPE1234F', kind: 'pan' });
    expect(takeQuickReferenceDraft()).toMatchObject({ value: 'ABCPE1234F' });
    expect(takeQuickReferenceDraft()).toBeNull();
  });
});
