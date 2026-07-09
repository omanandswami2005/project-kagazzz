/**
 * Settings-side app-lock controller (F-16): exposes the biometric-lock enable
 * state, availability, and auto-lock timeout for the Settings screen to render.
 * Enabling requires a successful biometric auth first ([SEC] — so a user can't
 * turn on a lock they can't satisfy and lock themselves out).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { biometricAuthenticator } from '../services/biometric.service';
import { useLockStore, type AutoLockTimeout } from '../store/lock.store';

/** What {@link useLockSettings} exposes. */
export interface LockSettings {
  enabled: boolean;
  timeout: AutoLockTimeout;
  /** null while checking; false = no biometric/credential enrolled. */
  available: boolean | null;
  /** True while an enable-time biometric prompt is in flight. */
  busy: boolean;
  /** Toggles the lock; turning it on runs a biometric prompt first. */
  toggle: (next: boolean) => void;
  setAutoLock: (timeout: AutoLockTimeout) => void;
}

/** Wires the Settings security controls to the lock store + biometrics. */
export function useLockSettings(): LockSettings {
  const { t } = useTranslation('common');
  const enabled = useLockStore((s) => s.enabled);
  const timeout = useLockStore((s) => s.timeout);
  const setEnabled = useLockStore((s) => s.setEnabled);
  const setAutoLock = useLockStore((s) => s.setLockTimeout);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void biometricAuthenticator.isAvailable().then((result) => {
      if (!cancelled) {
        setAvailable(result);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    (next: boolean): void => {
      if (!next) {
        setEnabled(false);
        return;
      }
      setBusy(true);
      void biometricAuthenticator.authenticate(t('lock.reason')).then((result) => {
        if (result === 'success') {
          setEnabled(true);
        }
        setBusy(false);
      });
    },
    [setEnabled, t]
  );

  return { enabled, timeout, available, busy, toggle, setAutoLock };
}
