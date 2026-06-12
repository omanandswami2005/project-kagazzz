/**
 * Route tree (P0-10). react-router v5 (Ionic peer requirement — never
 * bump, see ADR/Dependency Version Policy). Guards (auth/version) arrive
 * with F-16.
 *
 * The vault home answers on both '/' and '/vault' (no redirect): a
 * redirect at '/' put an extra entry in the history stack, so the
 * Android hardware back button looped through it instead of leaving
 * the app.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonRouterOutlet, useIonRouter, useIonToast } from '@ionic/react';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Route } from 'react-router-dom';
import { Spinner } from '@kagaz/ui';
import { LazyStoragePage, LazyVaultHomePage } from './lazy-imports';

/**
 * Android hardware back. Ionic registers its own navigation handler at
 * priority 0 that calls App.exitApp() when it cannot pop — and it does
 * NOT chain to lower-priority handlers, so anything below 0 never runs.
 * We therefore sit ABOVE 0 (priority 5) and take ownership: when the
 * router can still go back we defer to Ionic via processNext(); at the
 * true root we ask for a confirming second press before exiting
 * (double-back-to-exit). A vault-folder handler (VaultHomePage, priority
 * 10) sits above us to pop an open folder first. Supported pattern — see
 * ionicframework.com/docs/developing/hardware-back-button. Must live
 * inside <IonReactRouter> so useIonRouter has context.
 */
function useHardwareBack(): void {
  const ionRouter = useIonRouter();
  const { t } = useTranslation('common');
  const [presentToast, dismissToast] = useIonToast();
  const lastBack = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }
    const onBack = (event: Event): void => {
      (
        event as CustomEvent<{
          register: (
            priority: number,
            handler: (next: () => void) => void
          ) => void;
        }>
      ).detail.register(5, (next) => {
        if (ionRouter.canGoBack()) {
          next();
          return;
        }
        const now = Date.now();
        if (now - lastBack.current < 2000) {
          void CapacitorApp.exitApp();
        } else {
          lastBack.current = now;
          void presentToast({
            message: t('exit_hint'),
            duration: 1500,
            position: 'bottom',
          });
        }
      });
    };
    document.addEventListener('ionBackButton', onBack);
    return (): void => {
      document.removeEventListener('ionBackButton', onBack);
      void dismissToast();
    };
  }, [ionRouter, t, presentToast, dismissToast]);
}

/** Top-level routes inside the Ionic router outlet. */
export function AppRoutes(): ReactNode {
  useHardwareBack();
  return (
    <IonRouterOutlet>
      <Suspense fallback={<Spinner size="lg" label="Loading..." />}>
        <Route exact path={['/', '/vault']} component={LazyVaultHomePage} />
        <Route exact path="/storage" component={LazyStoragePage} />
      </Suspense>
    </IonRouterOutlet>
  );
}
