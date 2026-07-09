/**
 * App-lock state + persisted config (F-16, 10-security-architecture.md §3.1
 * "App-Level Lock"). Config lives in localStorage (not the SQLCipher DAO): the
 * lock decision happens at launch, before the DB is open, and localStorage is
 * synchronous. The enabled flag / timeout are not secrets. The biometric prompt
 * itself lives in biometric.service.ts.
 */
import { create } from 'zustand';

/** Auto-lock delay after the app is backgrounded (§3.1). */
export type AutoLockTimeout = 'immediate' | '30s' | '1min' | '5min';
export const AUTO_LOCK_TIMEOUTS: readonly AutoLockTimeout[] = [
  'immediate',
  '30s',
  '1min',
  '5min',
];
const TIMEOUT_MS: Record<AutoLockTimeout, number> = {
  immediate: 0,
  '30s': 30_000,
  '1min': 60_000,
  '5min': 300_000,
};

interface PersistedConfig {
  enabled: boolean;
  timeout: AutoLockTimeout;
}
const STORAGE_KEY = 'kagaz:lock';
const DEFAULT_CONFIG: PersistedConfig = { enabled: false, timeout: 'immediate' };

/** Reads the persisted lock config, tolerating missing/corrupt values. */
export function readLockConfig(): PersistedConfig {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_CONFIG;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CONFIG;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedConfig>;
    const timeout = AUTO_LOCK_TIMEOUTS.includes(parsed.timeout as AutoLockTimeout)
      ? (parsed.timeout as AutoLockTimeout)
      : 'immediate';
    return { enabled: parsed.enabled === true, timeout };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function writeLockConfig(config: PersistedConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Best-effort persistence (private mode / quota).
  }
}

/** The app-lock store shape. */
export interface LockState {
  enabled: boolean;
  timeout: AutoLockTimeout;
  /** True when the app UI must be gated behind an unlock. */
  locked: boolean;
  /** epoch ms the app was last backgrounded, or null. */
  backgroundedAt: number | null;
  setEnabled: (enabled: boolean) => void;
  setLockTimeout: (timeout: AutoLockTimeout) => void;
  /** Manually lock now (no-op when the feature is disabled). */
  lock: () => void;
  /** Mark the app unlocked (after a successful biometric auth). */
  unlock: () => void;
  /** App went to background — remember when (for the timeout). */
  markBackgrounded: (now: number) => void;
  /** App returned to foreground — lock if the auto-lock timeout elapsed. */
  evaluateOnForeground: (now: number) => void;
}

const initial = readLockConfig();

export const useLockStore = create<LockState>((set, get) => ({
  enabled: initial.enabled,
  timeout: initial.timeout,
  // Locked on launch when enabled — the vault requires an unlock first.
  locked: initial.enabled,
  backgroundedAt: null,

  setEnabled: (enabled): void => {
    writeLockConfig({ enabled, timeout: get().timeout });
    // Disabling unlocks immediately; enabling doesn't lock the live session.
    set({ enabled, locked: enabled ? get().locked : false });
  },

  setLockTimeout: (timeout): void => {
    writeLockConfig({ enabled: get().enabled, timeout });
    set({ timeout });
  },

  lock: (): void => {
    if (get().enabled) {
      set({ locked: true, backgroundedAt: null });
    }
  },

  unlock: (): void => set({ locked: false, backgroundedAt: null }),

  markBackgrounded: (now): void => {
    if (get().enabled && !get().locked) {
      set({ backgroundedAt: now });
    }
  },

  evaluateOnForeground: (now): void => {
    const { enabled, locked, backgroundedAt, timeout } = get();
    if (!enabled || locked || backgroundedAt === null) {
      set({ backgroundedAt: null });
      return;
    }
    const shouldLock = now - backgroundedAt >= TIMEOUT_MS[timeout];
    set({ locked: shouldLock, backgroundedAt: null });
  },
}));
