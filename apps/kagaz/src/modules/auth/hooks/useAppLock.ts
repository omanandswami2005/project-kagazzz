/**
 * App-lock wiring (F-16): binds the {@link useLockStore} to the Capacitor app
 * lifecycle (auto-lock on background, §3.1) and exposes a biometric unlock.
 * Mounted once, at the app root, via the LockGate.
 */
import { useCallback, useEffect } from 'react';
import { App } from '@capacitor/app';
import {
  biometricAuthenticator,
  type UnlockResult,
} from '../services/biometric.service';
import { useLockStore } from '../store/lock.store';

/** What {@link useAppLock} exposes. */
export interface AppLock {
  enabled: boolean;
  locked: boolean;
  /** Runs the biometric prompt with `reason`; unlocks on success. */
  attemptUnlock: (reason: string) => Promise<UnlockResult>;
}

/** Wires auto-lock to the app lifecycle and returns the lock state + unlock. */
export function useAppLock(): AppLock {
  const enabled = useLockStore((s) => s.enabled);
  const locked = useLockStore((s) => s.locked);
  const unlock = useLockStore((s) => s.unlock);
  const markBackgrounded = useLockStore((s) => s.markBackgrounded);
  const evaluateOnForeground = useLockStore((s) => s.evaluateOnForeground);

  useEffect(() => {
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        evaluateOnForeground(Date.now());
      } else {
        markBackgrounded(Date.now());
      }
    });
    return (): void => {
      void handle.then((h) => h.remove());
    };
  }, [markBackgrounded, evaluateOnForeground]);

  const attemptUnlock = useCallback(
    async (reason: string): Promise<UnlockResult> => {
      const result = await biometricAuthenticator.authenticate(reason);
      if (result === 'success') {
        unlock();
      }
      return result;
    },
    [unlock]
  );

  return { enabled, locked, attemptUnlock };
}
