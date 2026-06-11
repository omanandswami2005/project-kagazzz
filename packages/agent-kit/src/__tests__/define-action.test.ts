import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineAction } from '../define-action';

const valid = {
  id: 'vault.uploadDocument',
  summary: 'Upload a document.',
  args: z.object({ source: z.enum(['camera', 'gallery']).optional() }),
  requiresConfirmation: false,
  handler: async () => 'ok',
};

describe('defineAction', () => {
  it('returns a frozen definition for a valid config', () => {
    const action = defineAction(valid);
    expect(action.id).toBe('vault.uploadDocument');
    expect(Object.isFrozen(action)).toBe(true);
  });

  it('accepts hindi voice phrases and nested ids', () => {
    const action = defineAction({
      ...valid,
      id: 'csc.panCard.apply',
      voice: ['apply', 'पैन कार्ड'],
    });
    expect(action.voice).toContain('पैन कार्ड');
  });

  it.each([
    'UploadDocument',
    'vault',
    'vault..upload',
    '.upload',
    'Vault.upload',
    'vault.upload document',
  ])('rejects malformed id %s', (id) => {
    expect(() => defineAction({ ...valid, id })).toThrow('Invalid action id');
  });

  it('rejects an empty summary', () => {
    expect(() => defineAction({ ...valid, summary: '  ' })).toThrow(
      'non-empty summary'
    );
  });
});
