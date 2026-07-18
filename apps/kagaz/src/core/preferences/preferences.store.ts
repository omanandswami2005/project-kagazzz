/**
 * App UI preferences (non-secret, cross-module) — persisted in localStorage
 * so choices survive relaunch and are readable before the encrypted DB opens.
 * These are plain UX toggles, never PII or secrets (those live in the
 * SQLCipher DAO / platform keystore).
 *
 * First entry: `renameOnAdd` (UX-8) — whether to prompt for a name right after
 * a scan/upload. Settings writes it; the vault reads it. Add fields here as
 * more app-wide toggles appear.
 */
import { create } from 'zustand';

/** The persisted preference shape. */
export interface AppPreferences {
  /** UX-8: prompt to rename each document just after it is added. */
  renameOnAdd: boolean;
}

const STORAGE_KEY = 'kagaz:preferences';
const DEFAULTS: AppPreferences = { renameOnAdd: true };

/** Reads persisted preferences, tolerating missing/corrupt values. */
export function readPreferences(): AppPreferences {
  if (typeof localStorage === 'undefined') {
    return DEFAULTS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return { renameOnAdd: parsed.renameOnAdd !== false };
  } catch {
    return DEFAULTS;
  }
}

function writePreferences(prefs: AppPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best-effort persistence (private mode / quota).
  }
}

/** The preferences store shape. */
interface PreferencesStore extends AppPreferences {
  /** Sets the rename-on-add toggle (UX-8) and persists it. */
  setRenameOnAdd: (enabled: boolean) => void;
}

/** App-wide UI preference store (persisted). */
export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  ...readPreferences(),
  setRenameOnAdd: (renameOnAdd): void => {
    set({ renameOnAdd });
    writePreferences({ renameOnAdd: get().renameOnAdd });
  },
}));
