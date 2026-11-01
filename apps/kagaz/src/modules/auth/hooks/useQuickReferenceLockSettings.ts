/**
 * Settings-side controller for the Quick Reference biometric gate (F-84
 * follow-up). Unlike {@link useLockSettings}, enabling doesn't require an
 * up-front biometric proof: `QuickReferencePage` already skips the gate
 * gracefully when no biometric/device-credential is enrolled, so there is no
 * lockout risk to guard against here — this toggle only ever reduces friction,
 * never denies access.
 */
import { useQuickReferenceLockStore } from '../store/quick-reference-lock.store';

/** What {@link useQuickReferenceLockSettings} exposes. */
export interface QuickReferenceLockSettings {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
}

/** Wires the Settings security control to the Quick Reference lock store. */
export function useQuickReferenceLockSettings(): QuickReferenceLockSettings {
  const enabled = useQuickReferenceLockStore((s) => s.enabled);
  const setEnabled = useQuickReferenceLockStore((s) => s.setEnabled);
  return { enabled, setEnabled };
}
