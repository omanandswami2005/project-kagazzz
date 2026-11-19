/**
 * Starts the first-run welcome tour on the Documents screen once, at a
 * moment when its targets are really there: the page is on screen (after
 * its enter transition, so positions are final) and its data has loaded.
 * Onboarding and the app lock gate the whole route tree, so both are done
 * by the time this page renders. Hardware Back closes a running tour.
 */
import { Capacitor } from '@capacitor/core';
import { useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '@/core/preferences';
import { runTour, WELCOME_TOUR, WELCOME_TOUR_TIP, type TourHandle } from './tour';

/** Lets the page settle (FAB stagger, Recent strip) before measuring targets. */
const START_DELAY_MS = 600;

/** Runs the welcome tour once `ready` (the page's data has loaded). */
export function useWelcomeTour(ready: boolean): void {
  const { t } = useTranslation('common');
  const seen = usePreferencesStore((s) => s.seenTips.includes(WELCOME_TOUR_TIP));
  const markTipSeen = usePreferencesStore((s) => s.markTipSeen);
  const [onScreen, setOnScreen] = useState(false);
  const active = useRef<TourHandle | null>(null);

  useIonViewDidEnter(() => setOnScreen(true));
  useIonViewWillLeave(() => {
    setOnScreen(false);
    active.current?.destroy();
  });

  useEffect(() => {
    if (!ready || seen || !onScreen) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void runTour(WELCOME_TOUR, t, () => {
        active.current = null;
        markTipSeen(WELCOME_TOUR_TIP);
      }).then((handle) => {
        if (cancelled) handle?.destroy();
        else active.current = handle;
      });
    }, START_DELAY_MS);
    return (): void => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, seen, onScreen, t, markTipSeen]);

  // Back closes the tour first (above the vault's folder handler at 10).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const onBack = (event: Event): void => {
      (event as CustomEvent<{ register: (p: number, h: (next: () => void) => void) => void }>).detail.register(
        100,
        (next) => {
          if (active.current) active.current.destroy();
          else next();
        }
      );
    };
    document.addEventListener('ionBackButton', onBack);
    return (): void => document.removeEventListener('ionBackButton', onBack);
  }, []);
}
