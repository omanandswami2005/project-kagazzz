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
  /** UX pass (2026-07-24): whether `core/haptics` fires at all. On by
   * default (native only regardless — haptics is already a no-op on web). */
  hapticsEnabled: boolean;
  /** ISO time of the last successful encrypted backup, or null if never —
   * drives the Settings backup nudge (audit SE-6). Not PII. */
  lastBackupAt: string | null;
  /** One-time tips already shown (e.g. 'long-press'), so each shows once. */
  seenTips: string[];
  /** Favorites in the user's own order (document ids, FV-4). Not PII. */
  favoriteOrder: string[];
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
  hapticsEnabled: true,
  lastBackupAt: null,
  seenTips: [],
  favoriteOrder: [],
};

const SWIPE_ACTION_VALUES: readonly SwipeActionKind[] = [
  'delete',
  'favorite',
  'move',
  'tags',
  'archive',
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

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

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
      hapticsEnabled: parsed.hapticsEnabled !== false,
      lastBackupAt:
        typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
      seenTips: stringArray(parsed.seenTips),
      favoriteOrder: stringArray(parsed.favoriteOrder),
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
  /** Sets whether haptic feedback fires app-wide and persists it. */
  setHapticsEnabled: (enabled: boolean) => void;
  /** Records when the last encrypted backup finished (audit SE-6). */
  setLastBackupAt: (iso: string) => void;
  /** Marks a one-time tip as shown. */
  markTipSeen: (tip: string) => void;
  /** Shows a one-time tip again (Settings → Replay the tour). */
  forgetTip: (tip: string) => void;
  /** Saves the user's Favorites order (FV-4). */
  setFavoriteOrder: (ids: string[]) => void;
}

/** App-wide UI preference store (persisted). */
export const usePreferencesStore = create<PreferencesStore>((set, get) => {
  const persist = (): void => {
    const {
      renameOnAdd,
      recentSectionCollapsed,
      swipeLeftAction,
      swipeRightAction,
      hapticsEnabled,
      lastBackupAt,
      seenTips,
      favoriteOrder,
    } = get();
    writePreferences({
      renameOnAdd,
      recentSectionCollapsed,
      swipeLeftAction,
      swipeRightAction,
      hapticsEnabled,
      lastBackupAt,
      seenTips,
      favoriteOrder,
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
    setHapticsEnabled: (hapticsEnabled): void => {
      set({ hapticsEnabled });
      persist();
    },
    setLastBackupAt: (lastBackupAt): void => {
      set({ lastBackupAt });
      persist();
    },
    setFavoriteOrder: (favoriteOrder): void => {
      set({ favoriteOrder });
      persist();
    },
    markTipSeen: (tip): void => {
      if (get().seenTips.includes(tip)) return;
      set({ seenTips: [...get().seenTips, tip] });
      persist();
    },
    forgetTip: (tip): void => {
      set({ seenTips: get().seenTips.filter((t) => t !== tip) });
      persist();
    },
  };
});
