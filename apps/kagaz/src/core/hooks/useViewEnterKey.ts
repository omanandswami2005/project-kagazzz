/**
 * Page caching support (device feedback 2026-11-19). Ionic keeps a visited
 * page mounted in its stack, so a hook that loads once on mount would show
 * stale data when the user comes back. This returns a number that bumps each
 * time the page is entered again (not on the first entry); pass it as a
 * hook's reload key so the data refreshes in place, without a remount or a
 * loading flash.
 */
import { useIonViewWillEnter } from '@ionic/react';
import { useRef, useState } from 'react';

/** 0 on first show; +1 every later time the cached page becomes visible. */
export function useViewEnterKey(): number {
  const [key, setKey] = useState(0);
  const entered = useRef(false);
  useIonViewWillEnter(() => {
    if (entered.current) {
      setKey((k) => k + 1);
    }
    entered.current = true;
  });
  return key;
}
