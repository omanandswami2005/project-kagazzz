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
import type { SwipeActionKind } from '@/core/gestures';

/** The persisted preference shape. */
export interface AppPreferences {
  /** UX-8: prompt to rename each document just after it is added. */
  renameOnAdd: boolean;
  /** UX pass (2026-07-23): collapse the vault home "Recent" strip — the
   * row itself is already height-bounded (single horizontal scroller,
   * F-32), this is purely "let me reclaim the vertical space." */
  recentSectionCollapsed: boolean;
  /** F-88: action fired when a document row is swiped left. */
  swipeLeftAction: SwipeActionKind;
  /** F-88: action fired when a document row is swiped right. */
  swipeRightAction: SwipeActionKind;
}

const STORAGE_KEY = 'kagaz:preferences';
const DEFAULTS: AppPreferences = {
  renameOnAdd: true,
  recentSectionCollapsed: false,
  // Gmail-style defaults: the destructive action on one side, the most
  // common toggle on the other. Both remain reversible from the row's own
  // menu/star button — swipe is only ever an accelerator (F-88).
  swipeLeftAction: 'delete',
  swipeRightAction: 'favorite',
};

const SWIPE_ACTION_VALUES: readonly SwipeActionKind[] = [
  'delete',
  'favorite',
  'move',
  'tags',
  'none',
];

function readSwipeAction(
  value: unknown,
  fallback: SwipeActionKind
): SwipeActionKind {
  return typeof value === 'string' &&
    (SWIPE_ACTION_VALUES as readonly string[]).includes(value)
    ? (value as SwipeActionKind)
    : fallback;
}

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
    return {
      renameOnAdd: parsed.renameOnAdd !== false,
      recentSectionCollapsed: parsed.recentSectionCollapsed === true,
      swipeLeftAction: readSwipeAction(parsed.swipeLeftAction, DEFAULTS.swipeLeftAction),
      swipeRightAction: readSwipeAction(
        parsed.swipeRightAction,
        DEFAULTS.swipeRightAction
      ),
    };
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
  /** Sets whether the Recent strip is collapsed and persists it. */
  setRecentSectionCollapsed: (collapsed: boolean) => void;
  /** Sets which action fires on swipe-left/right (F-88) and persists it. */
  setSwipeAction: (side: 'left' | 'right', action: SwipeActionKind) => void;
}

/** App-wide UI preference store (persisted). */
export const usePreferencesStore = create<PreferencesStore>((set, get) => {
  const persist = (): void => {
    const { renameOnAdd, recentSectionCollapsed, swipeLeftAction, swipeRightAction } =
      get();
    writePreferences({
      renameOnAdd,
      recentSectionCollapsed,
      swipeLeftAction,
      swipeRightAction,
    });
  };
  return {
    ...readPreferences(),
    setRenameOnAdd: (renameOnAdd): void => {
      set({ renameOnAdd });
      persist();
    },
    setRecentSectionCollapsed: (recentSectionCollapsed): void => {
      set({ recentSectionCollapsed });
      persist();
    },
    setSwipeAction: (side, action): void => {
      set(side === 'left' ? { swipeLeftAction: action } : { swipeRightAction: action });
      persist();
    },
  };
});
