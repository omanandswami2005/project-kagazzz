/**
 * Quick Reference lock preference (F-84 follow-up,
 * 10-security-architecture.md §3.6). Whether the screen-level biometric gate
 * (`LockScreen` via `QuickReferencePage`) runs at all. Defaults to **enabled**
 * — Quick Reference is the app's highest-sensitivity screen (Aadhaar/PAN/bank
 * values, §3.6.1) — but unlike F-16's app lock this one ships on by default
 * rather than opt-in, so it needs an explicit off switch for users who find a
 * gate on every visit too much friction for a phone they already keep locked.
 * Persisted in localStorage next to `lock.store.ts` for the same reason: the
 * decision is read before the screen (and its DB-backed data) opens.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'kagaz:lock:quick-reference';
const DEFAULT_ENABLED = true;

/** Reads the persisted preference, tolerating missing/corrupt values. */
export function readQuickReferenceLockEnabled(): boolean {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_ENABLED;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_ENABLED;
    }
    return (JSON.parse(raw) as { enabled?: unknown }).enabled !== false;
  } catch {
    return DEFAULT_ENABLED;
  }
}

function writeQuickReferenceLockEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled }));
  } catch {
    // Best-effort persistence (private mode / quota).
  }
}

/** The Quick Reference lock preference store shape. */
export interface QuickReferenceLockState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useQuickReferenceLockStore = create<QuickReferenceLockState>(
  (set) => ({
    enabled: readQuickReferenceLockEnabled(),
    setEnabled: (enabled): void => {
      writeQuickReferenceLockEnabled(enabled);
      set({ enabled });
    },
  })
);
