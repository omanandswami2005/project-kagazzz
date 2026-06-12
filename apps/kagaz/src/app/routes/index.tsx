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
import { IonRouterOutlet, useIonRouter } from '@ionic/react';
import { Suspense, useEffect, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { Spinner } from '@kagaz/ui';
import { LazyStoragePage, LazyVaultHomePage } from './lazy-imports';

/**
 * Android hardware back. Ionic's own handler (higher priority) pops the
 * page stack; this lowest-priority handler only fires when there is
 * nothing left to pop — then it exits the app. Using ionRouter.canGoBack()
 * (not pathname/history.back) is the supported pattern — see
 * ionicframework.com/docs/developing/hardware-back-button. Must live
 * inside <IonReactRouter> so useIonRouter has context.
 */
function useHardwareBack(): void {
  const ionRouter = useIonRouter();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }
    const onBack = (event: Event): void => {
      (
        event as CustomEvent<{
          register: (priority: number, handler: () => void) => void;
        }>
      ).detail.register(-1, () => {
        if (!ionRouter.canGoBack()) {
          void CapacitorApp.exitApp();
        }
      });
    };
    document.addEventListener('ionBackButton', onBack);
    return (): void => document.removeEventListener('ionBackButton', onBack);
  }, [ionRouter]);
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
