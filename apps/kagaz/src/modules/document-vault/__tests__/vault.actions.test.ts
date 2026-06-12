import { describe, expect, it, vi } from 'vitest';
import { ActionRegistry } from '@kagaz/agent-kit';
import { vaultActions, type VaultActionContext } from '../vault.actions';
import { useVaultStore } from '../store/vault.store';

function makeCtx(): VaultActionContext {
  return {
    openUploadSheet: vi.fn(),
    uploadFrom: vi.fn(() => Promise.resolve({ uploaded: 2 })),
    toggleFavorite: vi.fn(() => Promise.resolve({ isFavorite: true })),
    search: vi.fn(),
    createFolder: vi.fn(() => Promise.resolve({ folderId: 'f-1' })),
    createStarterFolders: vi.fn(() => Promise.resolve({ count: 7 })),
    moveDocument: vi.fn(() => Promise.resolve()),
    openFilters: vi.fn(),
    clearFilters: vi.fn(),
    bulkDelete: vi.fn(() => Promise.resolve({ count: 2 })),
    bulkFavorite: vi.fn(() => Promise.resolve({ count: 2 })),
    manageTags: vi.fn(),
    tagDocument: vi.fn(() => Promise.resolve({ tagId: 'tag-1' })),
  };
}

describe('vault.uploadDocument', () => {
  it('declares the contract (id, summary, no confirmation, voice)', () => {
    const action = vaultActions.uploadDocument;
    expect(action.id).toBe('vault.uploadDocument');
    expect(action.requiresConfirmation).toBe(false);
    expect(action.summary.length).toBeGreaterThan(0);
    expect(action.voice?.length).toBeGreaterThan(0);
  });

  it('opens the source sheet when no source is given', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.uploadDocument.handler({}, ctx)
    ).resolves.toEqual({ uploaded: 0 });
    expect(ctx.openUploadSheet).toHaveBeenCalledOnce();
    expect(ctx.uploadFrom).not.toHaveBeenCalled();
  });

  it('starts the upload directly when a source is given', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.uploadDocument.handler({ source: 'gallery' }, ctx)
    ).resolves.toEqual({ uploaded: 2 });
    expect(ctx.uploadFrom).toHaveBeenCalledWith('gallery');
  });

  it('rejects bad sources through registry arg validation', async () => {
    const registry = new ActionRegistry<VaultActionContext>();
    registry.register(vaultActions.uploadDocument);
    const result = await registry.invoke(
      'vault.uploadDocument',
      { source: 'usb-stick' },
      makeCtx()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AGENT_E_INVALID_ARGS');
    }
  });

  it('invokes end-to-end through the registry envelope', async () => {
    const registry = new ActionRegistry<VaultActionContext>();
    registry.register(vaultActions.uploadDocument);
    const result = await registry.invoke(
      'vault.uploadDocument',
      { source: 'camera' },
      makeCtx()
    );
    expect(result).toEqual({ ok: true, data: { uploaded: 2 } });
  });
});

describe('vault.toggleFavorite (F-33)', () => {
  it('delegates to ctx.toggleFavorite with the document id', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.toggleFavorite.handler({ documentId: 'doc-9' }, ctx)
    ).resolves.toEqual({ isFavorite: true });
    expect(ctx.toggleFavorite).toHaveBeenCalledWith('doc-9');
  });

  it('rejects a missing document id through the registry', async () => {
    const registry = new ActionRegistry<VaultActionContext>();
    registry.register(vaultActions.toggleFavorite);
    const result = await registry.invoke('vault.toggleFavorite', {}, makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe('vault bulk actions (F-25)', () => {
  it('bulkDelete requires confirmation and returns the count', async () => {
    expect(vaultActions.bulkDelete.requiresConfirmation).toBe(true);
    const ctx = makeCtx();
    await expect(vaultActions.bulkDelete.handler({}, ctx)).resolves.toEqual({
      count: 2,
    });
    expect(ctx.bulkDelete).toHaveBeenCalledOnce();
  });

  it('bulkFavorite is non-destructive and delegates', async () => {
    expect(vaultActions.bulkFavorite.requiresConfirmation).toBe(false);
    const ctx = makeCtx();
    await vaultActions.bulkFavorite.handler({}, ctx);
    expect(ctx.bulkFavorite).toHaveBeenCalledOnce();
  });
});

describe('vault filter actions (F-12)', () => {
  it('openFilters and clearFilters delegate to the context', async () => {
    const ctx = makeCtx();
    await vaultActions.openFilters.handler({}, ctx);
    await vaultActions.clearFilters.handler({}, ctx);
    expect(ctx.openFilters).toHaveBeenCalledOnce();
    expect(ctx.clearFilters).toHaveBeenCalledOnce();
  });
});

describe('vault folder actions (F-9)', () => {
  it('createFolder delegates to ctx and rejects empty names', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.createFolder.handler({ name: 'Taxes' }, ctx)
    ).resolves.toEqual({ folderId: 'f-1' });
    expect(ctx.createFolder).toHaveBeenCalledWith('Taxes');

    const registry = new ActionRegistry<VaultActionContext>();
    registry.register(vaultActions.createFolder);
    const bad = await registry.invoke('vault.createFolder', { name: '' }, makeCtx());
    expect(bad.ok).toBe(false);
  });

  it('createStarterFolders delegates and returns the count (F-30)', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.createStarterFolders.handler({}, ctx)
    ).resolves.toEqual({ count: 7 });
    expect(ctx.createStarterFolders).toHaveBeenCalledOnce();
  });

  it('moveDocument accepts a folder id or null (root)', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.moveDocument.handler(
        { documentId: 'd1', folderId: null },
        ctx
      )
    ).resolves.toEqual({ ok: true });
    expect(ctx.moveDocument).toHaveBeenCalledWith('d1', null);
  });
});

describe('vault.searchDocuments (F-11)', () => {
  it('sets the query via ctx.search', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.searchDocuments.handler({ query: 'aadhaar' }, ctx)
    ).resolves.toEqual({ query: 'aadhaar' });
    expect(ctx.search).toHaveBeenCalledWith('aadhaar');
  });
});

describe('vault tag actions (F-10)', () => {
  it('manageTags opens the selector for a document', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.manageTags.handler({ documentId: 'doc-1' }, ctx)
    ).resolves.toEqual({ ok: true });
    expect(ctx.manageTags).toHaveBeenCalledWith('doc-1');
  });

  it('tagDocument delegates to ctx with id + tag', async () => {
    const ctx = makeCtx();
    await expect(
      vaultActions.tagDocument.handler(
        { documentId: 'doc-1', tag: 'important' },
        ctx
      )
    ).resolves.toEqual({ tagId: 'tag-1' });
    expect(ctx.tagDocument).toHaveBeenCalledWith('doc-1', 'important');
  });

  it('tagDocument rejects an empty tag through the registry', async () => {
    const registry = new ActionRegistry<VaultActionContext>();
    registry.register(vaultActions.tagDocument);
    const result = await registry.invoke(
      'vault.tagDocument',
      { documentId: 'd', tag: '' },
      makeCtx()
    );
    expect(result.ok).toBe(false);
  });
});

describe('vault sort actions (F-34)', () => {
  it('setSortBy updates the store and rejects bad keys', async () => {
    await expect(
      vaultActions.setSortBy.handler({ key: 'fileSize' }, makeCtx())
    ).resolves.toEqual({ key: 'fileSize' });
    expect(useVaultStore.getState().sortBy).toBe('fileSize');

    const registry = new ActionRegistry<VaultActionContext>();
    registry.register(vaultActions.setSortBy);
    const bad = await registry.invoke('vault.setSortBy', { key: 'nope' }, makeCtx());
    expect(bad.ok).toBe(false);
  });

  it('toggleSortDirection flips the store direction', async () => {
    useVaultStore.setState({ sortDirection: 'desc' });
    await expect(
      vaultActions.toggleSortDirection.handler({}, makeCtx())
    ).resolves.toEqual({ direction: 'asc' });
    expect(useVaultStore.getState().sortDirection).toBe('asc');
  });
});
