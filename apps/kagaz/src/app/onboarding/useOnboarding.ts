/**
 * First-launch onboarding state (F-27). Tracks whether the user has seen the
 * intro walkthrough, persisted to localStorage (like the theme/lock prefs, it
 * lives outside the DB so it's available before `DatabaseProvider` mounts).
 */
import { useCallback, useState } from 'react';

const ONBOARDING_SEEN_KEY = 'kagaz:onboarding-seen';

function readOnboardingSeen(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
}

function storeOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
  } catch {
    // Private mode / quota — persistence is best-effort, not fatal.
  }
}

/** What {@link useOnboarding} exposes. */
export interface UseOnboarding {
  /** True until the walkthrough has been completed or skipped. */
  showOnboarding: boolean;
  /** Marks onboarding done (skip or finish) and persists it. */
  complete: () => void;
}

/** Gates the first-launch onboarding walkthrough. */
export function useOnboarding(): UseOnboarding {
  const [seen, setSeen] = useState<boolean>(readOnboardingSeen);

  const complete = useCallback((): void => {
    storeOnboardingSeen();
    setSeen(true);
  }, []);

  return { showOnboarding: !seen, complete };
}
