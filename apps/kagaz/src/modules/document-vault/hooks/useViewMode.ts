/**
 * View-mode preference (UX-7) — lets the user switch the vault list between
 * List, Grid, and Compact density, persisted across launches. Purely a
 * presentation choice: it changes a container class, never the data.
 */
import { useCallback, useState } from 'react';
import { log } from '@/core/logging';

/** The three document-list layouts the user can choose between. */
export type ViewMode = 'list' | 'grid' | 'compact';

const STORAGE_KEY = 'kagaz:view-mode';
const MODES: readonly ViewMode[] = ['list', 'grid', 'compact'];

/** Reads the persisted mode, falling back to List for any unknown value. */
function readMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (MODES as readonly string[]).includes(stored)) {
      return stored as ViewMode;
    }
  } catch {
    // Private-mode / disabled storage — fall back to the default.
  }
  return 'list';
}

/** Return type of {@link useViewMode}. */
export interface UseViewMode {
  /** The active list layout. */
  mode: ViewMode;
  /** Selects a layout and persists the choice. */
  setMode: (next: ViewMode) => void;
}

/** Persisted vault list view-mode (UX-7). */
export function useViewMode(): UseViewMode {
  const [mode, setModeState] = useState<ViewMode>(readMode);

  const setMode = useCallback((next: ViewMode): void => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice just won't survive a restart.
    }
    log('document-vault').info({ event: 'vault.view-mode.change', mode: next });
  }, []);

  return { mode, setMode };
}
