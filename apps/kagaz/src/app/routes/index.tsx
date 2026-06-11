/**
 * Route tree (P0-10). react-router v5 (Ionic peer requirement — never
 * bump, see ADR/Dependency Version Policy). Guards (auth/version) arrive
 * with F-16.
 */
import { IonRouterOutlet } from '@ionic/react';
import { Suspense, type ReactNode } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { Spinner } from '@kagaz/ui';
import { LazyVaultHomePage } from './lazy-imports';

/** Top-level routes inside the Ionic router outlet. */
export function AppRoutes(): ReactNode {
  return (
    <IonRouterOutlet>
      <Suspense fallback={<Spinner size="lg" label="Loading..." />}>
        <Route exact path="/">
          <Redirect to="/vault" />
        </Route>
        <Route exact path="/vault" component={LazyVaultHomePage} />
      </Suspense>
    </IonRouterOutlet>
  );
}
