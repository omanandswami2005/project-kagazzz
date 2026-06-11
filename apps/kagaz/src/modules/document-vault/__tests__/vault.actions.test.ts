import { describe, expect, it, vi } from 'vitest';
import { ActionRegistry } from '@kagaz/agent-kit';
import { vaultActions, type VaultActionContext } from '../vault.actions';
import { useVaultStore } from '../store/vault.store';

function makeCtx(): VaultActionContext {
  return {
    openUploadSheet: vi.fn(),
    uploadFrom: vi.fn(() => Promise.resolve({ uploaded: 2 })),
    toggleFavorite: vi.fn(() => Promise.resolve({ isFavorite: true })),
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
