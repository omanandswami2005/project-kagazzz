/**
 * App-lock gate (F-16): mounted once at the app root. Wires the auto-lock
 * lifecycle and renders the {@link LockScreen} instead of the app whenever the
 * lock is enabled and engaged; otherwise renders the app untouched.
 */
import { type ReactNode } from 'react';
import { useAppLock } from '../hooks/useAppLock';
import { LockScreen } from './LockScreen';

/** Gates its children behind the biometric app-lock when engaged. */
export function LockGate({ children }: { children: ReactNode }): ReactNode {
  const { enabled, locked, attemptUnlock } = useAppLock();
  if (enabled && locked) {
    return <LockScreen onUnlock={attemptUnlock} />;
  }
  return <>{children}</>;
}
