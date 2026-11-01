/**
 * Per-document lock (SEC-V1 §8 #4, 10-security-architecture.md §3.1). A locked
 * document needs a biometric prompt to open or to unlock, its thumbnail is
 * blurred in the list, and it's excluded from search. This is independent of
 * the app-level lock (F-16) and reuses the same biometric authenticator.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { biometricAuthenticator } from '@/modules/auth/services/biometric.service';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useVaultMutations } from './useVaultMutations';

/** What {@link useDocLock} exposes. */
export interface DocLock {
  /**
   * Locks (no auth) or unlocks (biometric auth required) a document.
   * Resolves true when the lock state changed, false if auth was declined.
   */
  toggleLock: (document: DocumentEntity) => Promise<boolean>;
  /**
   * Whether the user may open a document now: unlocked docs always pass;
   * locked docs require a successful biometric prompt.
   */
  authorizeView: (document: DocumentEntity) => Promise<boolean>;
  /**
   * Batch form of {@link authorizeView} for a bulk action (e.g. multi-select
   * Share) — a single biometric prompt covers the whole selection when at
   * least one document is locked, rather than one prompt per locked item.
   */
  authorizeViewMany: (documents: DocumentEntity[]) => Promise<boolean>;
}

/** Wires per-document lock gating to the biometric prompt + vault mutations. */
export function useDocLock(): DocLock {
  const { t } = useTranslation('documents');
  const { setLocked } = useVaultMutations();

  const toggleLock = useCallback(
    async (document: DocumentEntity): Promise<boolean> => {
      // Locking is protective and free; removing the lock needs auth so nobody
      // can un-protect a document just by picking up an unlocked phone. [SEC]
      if (!document.isLocked) {
        await setLocked(document, true);
        return true;
      }
      const result = await biometricAuthenticator.authenticate(t('lock.reason'));
      if (result === 'success') {
        await setLocked(document, false);
        return true;
      }
      return false;
    },
    [setLocked, t]
  );

  const authorizeView = useCallback(
    async (document: DocumentEntity): Promise<boolean> => {
      if (!document.isLocked) {
        return true;
      }
      const result = await biometricAuthenticator.authenticate(t('lock.reason'));
      return result === 'success';
    },
    [t]
  );

  const authorizeViewMany = useCallback(
    async (documents: DocumentEntity[]): Promise<boolean> => {
      if (!documents.some((document) => document.isLocked)) {
        return true;
      }
      const result = await biometricAuthenticator.authenticate(t('lock.reason'));
      return result === 'success';
    },
    [t]
  );

  return { toggleLock, authorizeView, authorizeViewMany };
}
