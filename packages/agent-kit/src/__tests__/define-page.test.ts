import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineAction } from '../define-action';
import { definePage } from '../define-page';

const upload = defineAction({
  id: 'vault.uploadDocument',
  summary: 'Upload a document.',
  args: z.object({}),
  requiresConfirmation: false,
  handler: async () => undefined,
});

const search = defineAction({
  id: 'vault.searchDocuments',
  summary: 'Search documents.',
  args: z.object({ q: z.string() }),
  requiresConfirmation: false,
  handler: async () => [],
});

describe('definePage', () => {
  it('returns a frozen manifest with screen as the default surface', () => {
    const page = definePage({
      id: 'vault.list',
      route: '/vault',
      intent: 'Show every document.',
      primaryAction: upload,
      availableActions: [upload, search],
      voiceExamples: [
        { utterance: 'upload a new file', action: 'vault.uploadDocument' },
      ],
    });
    expect(page.surfaces).toEqual(['screen']);
    expect(Object.isFrozen(page)).toBe(true);
  });

  it('rejects a primaryAction missing from availableActions', () => {
    expect(() =>
      definePage({
        id: 'vault.list',
        route: '/vault',
        intent: 'x',
        primaryAction: upload,
        availableActions: [search],
      })
    ).toThrow('must be in availableActions');
  });

  it('rejects malformed ids and routes', () => {
    expect(() =>
      definePage({ id: 'Vault.List', route: '/v', intent: 'x', availableActions: [] })
    ).toThrow('Invalid page id');
    expect(() =>
      definePage({ id: 'vault.list', route: 'vault', intent: 'x', availableActions: [] })
    ).toThrow('must start with "/"');
  });

  it('rejects duplicate actions and dangling voice examples', () => {
    expect(() =>
      definePage({
        id: 'vault.list',
        route: '/vault',
        intent: 'x',
        availableActions: [upload, upload],
      })
    ).toThrow('duplicate action');
    expect(() =>
      definePage({
        id: 'vault.list',
        route: '/vault',
        intent: 'x',
        availableActions: [upload],
        voiceExamples: [{ utterance: 'find it', action: 'vault.searchDocuments' }],
      })
    ).toThrow('unlisted action');
  });
});
