import { describe, expect, it, vi } from 'vitest';
import { ActionRegistry } from '@kagaz/agent-kit';
import { vaultActions, type VaultActionContext } from '../vault.actions';
import { useVaultStore } from '../store/vault.store';

function makeCtx(): VaultActionContext {
  return {
    openUploadSheet: vi.fn(),
    uploadFrom: vi.fn(() => Promise.resolve({ uploaded: 2 })),
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
