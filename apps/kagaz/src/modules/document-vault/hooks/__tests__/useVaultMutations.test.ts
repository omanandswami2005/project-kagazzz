import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { softDeleteDao, restoreDao } = vi.hoisted(() => ({
  softDeleteDao: vi.fn(),
  restoreDao: vi.fn(),
}));

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: () => ({ db: {} }) }));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    softDelete = softDeleteDao;
    restore = restoreDao;
    update = vi.fn();
    touchLastAccessed = vi.fn();
  },
}));

import { useVaultMutations } from '../useVaultMutations';
import { useVaultStore } from '../../store/vault.store';

const doc = (id: string): DocumentEntity =>
  ({ id, name: id, createdAt: '2026-07-12T00:00:00Z' }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  softDeleteDao.mockResolvedValue(1);
  restoreDao.mockResolvedValue(1);
  useVaultStore.getState().setDocuments([doc('a'), doc('b')]);
});

describe('useVaultMutations softDelete/restore (UX-1)', () => {
  it('softDelete removes the doc from the list and persists', async () => {
    const { result } = renderHook(() => useVaultMutations());
    await act(async () => {
      await result.current.softDelete(doc('a'));
    });
    expect(softDeleteDao).toHaveBeenCalledWith('a');
    expect(useVaultStore.getState().documents.map((d) => d.id)).toEqual(['b']);
  });

  it('restore re-adds the doc and persists', async () => {
    const { result } = renderHook(() => useVaultMutations());
    await act(async () => {
      await result.current.softDelete(doc('a'));
      await result.current.restore(doc('a'));
    });
    expect(restoreDao).toHaveBeenCalledWith('a');
    expect(useVaultStore.getState().documents.map((d) => d.id)).toContain('a');
  });

  it('rolls back the optimistic removal when the DAO delete fails', async () => {
    softDeleteDao.mockRejectedValue(new Error('db'));
    const { result } = renderHook(() => useVaultMutations());
    await act(async () => {
      await result.current.softDelete(doc('a'));
    });
    expect(useVaultStore.getState().documents.map((d) => d.id)).toContain('a');
  });
});
