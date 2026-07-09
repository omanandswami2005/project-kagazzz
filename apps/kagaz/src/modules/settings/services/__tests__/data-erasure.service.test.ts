import { describe, expect, it, vi } from 'vitest';
import { eraseAllData, type EraseDeps } from '../data-erasure.service';

function makeDeps(): { deps: EraseDeps; order: string[] } {
  const order: string[] = [];
  const deps: EraseDeps = {
    deleteDatabase: vi.fn(async () => {
      order.push('db');
    }),
    clearFiles: vi.fn(async (dir: string) => {
      order.push(`files:${dir}`);
    }),
    clearSecureStorage: vi.fn(async () => {
      order.push('secure');
    }),
    clearPreferences: vi.fn(() => {
      order.push('prefs');
    }),
    reload: vi.fn(() => {
      order.push('reload');
    }),
  };
  return { deps, order };
}

describe('eraseAllData (SEC-V1 #12)', () => {
  it('runs every step, deletes the DB before clearing its key, and reloads last', async () => {
    const { deps, order } = makeDeps();

    await eraseAllData(deps);

    expect(deps.deleteDatabase).toHaveBeenCalledOnce();
    expect(deps.clearFiles).toHaveBeenCalledTimes(4); // documents/thumbnails/temp/backups
    expect(deps.clearSecureStorage).toHaveBeenCalledOnce();
    expect(deps.clearPreferences).toHaveBeenCalledOnce();
    expect(deps.reload).toHaveBeenCalledOnce();

    // [SEC] the encrypted DB must be deleted while its key is still active.
    expect(order[0]).toBe('db');
    expect(order.indexOf('secure')).toBeGreaterThan(order.indexOf('db'));
    expect(order.at(-1)).toBe('reload');
  });

  it('continues (and still reloads) when a directory clear fails', async () => {
    const { deps } = makeDeps();
    deps.clearFiles = vi.fn(async (dir: string) => {
      if (dir === 'documents') {
        throw new Error('boom');
      }
    });

    await expect(eraseAllData(deps)).resolves.toBeUndefined();
    expect(deps.reload).toHaveBeenCalledOnce();
  });

  it('still clears prefs and reloads even if deleting the DB throws', async () => {
    const { deps } = makeDeps();
    deps.deleteDatabase = vi.fn(async () => {
      throw new Error('db locked');
    });

    await expect(eraseAllData(deps)).resolves.toBeUndefined();
    expect(deps.clearPreferences).toHaveBeenCalledOnce();
    expect(deps.reload).toHaveBeenCalledOnce();
  });
});
