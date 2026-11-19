/**
 * Starts a one-time spotlight tour on an Ionic page, at a moment when its
 * targets are really there: the page is on screen (after its enter
 * transition, so positions are final) and the caller says it's `ready`
 * (data loaded, nothing else on top). Onboarding and the app lock gate the
 * whole route tree, so both are done by the time a page renders. Leaving the
 * page closes a running tour; Back closes it too (runTour).
 */
import { useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '@/core/preferences';
import { runTour, type TourHandle, type TourStep } from './tour';

/** Lets the page settle (FAB stagger, Recent strip) before measuring targets. */
const START_DELAY_MS = 600;

/** Runs `steps` once per `tip` (a `seenTips` id), as soon as `ready`. */
export function useFirstRunTour(steps: readonly TourStep[], tip: string, ready: boolean): void {
  const { t } = useTranslation('common');
  const seen = usePreferencesStore((s) => s.seenTips.includes(tip));
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
      void runTour(steps, t, () => {
        active.current = null;
        markTipSeen(tip);
      }).then((handle) => {
        if (cancelled) handle?.destroy();
        else active.current = handle;
      });
    }, START_DELAY_MS);
    return (): void => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, seen, onScreen, steps, tip, t, markTipSeen]);
}
