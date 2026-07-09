import { renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useDocLock } from '../useDocLock';

const { authenticate, setLocked } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  setLocked: vi.fn(),
}));

vi.mock('@/modules/auth/services/biometric.service', () => ({
  biometricAuthenticator: { authenticate, isAvailable: vi.fn() },
}));
vi.mock('../useVaultMutations', () => ({
  useVaultMutations: () => ({
    setLocked,
    toggleFavorite: vi.fn(),
    markAccessed: vi.fn(),
  }),
}));

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});
beforeEach(() => {
  authenticate.mockReset();
  setLocked.mockReset();
});

const doc = (isLocked: boolean): DocumentEntity =>
  ({ id: 'd1', isLocked }) as unknown as DocumentEntity;

describe('useDocLock (SEC-V1 #4)', () => {
  it('locks a document without a biometric prompt', async () => {
    const { result } = renderHook(() => useDocLock());
    const changed = await result.current.toggleLock(doc(false));

    expect(changed).toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
    expect(setLocked).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }), true);
  });

  it('requires biometric auth to unlock, and only then flips the flag', async () => {
    const { result } = renderHook(() => useDocLock());

    authenticate.mockResolvedValueOnce('failed');
    expect(await result.current.toggleLock(doc(true))).toBe(false);
    expect(setLocked).not.toHaveBeenCalled();

    authenticate.mockResolvedValueOnce('success');
    expect(await result.current.toggleLock(doc(true))).toBe(true);
    expect(setLocked).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }), false);
  });

  it('gates viewing a locked doc but lets an unlocked one through untouched', async () => {
    const { result } = renderHook(() => useDocLock());

    expect(await result.current.authorizeView(doc(false))).toBe(true);
    expect(authenticate).not.toHaveBeenCalled();

    authenticate.mockResolvedValueOnce('success');
    expect(await result.current.authorizeView(doc(true))).toBe(true);
    expect(authenticate).toHaveBeenCalledOnce();
  });
});
