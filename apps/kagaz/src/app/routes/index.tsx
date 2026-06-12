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
import { IonRouterOutlet } from '@ionic/react';
import { Suspense, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { Spinner } from '@kagaz/ui';
import { LazyStoragePage, LazyVaultHomePage } from './lazy-imports';

/** Top-level routes inside the Ionic router outlet. */
export function AppRoutes(): ReactNode {
  return (
    <IonRouterOutlet>
      <Suspense fallback={<Spinner size="lg" label="Loading..." />}>
        <Route exact path={['/', '/vault']} component={LazyVaultHomePage} />
        <Route exact path="/storage" component={LazyStoragePage} />
      </Suspense>
    </IonRouterOutlet>
  );
}
