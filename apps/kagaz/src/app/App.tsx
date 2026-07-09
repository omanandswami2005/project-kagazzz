/**
 * Root component (P0-10): Ionic app shell + providers + routes.
 */
import { IonApp, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import type { ReactNode } from 'react';
import { LockGate } from '@/modules/auth/components/LockGate';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './routes';

setupIonicReact();

/** The Kagaz application. */
export function App(): ReactNode {
  return (
    <AppProviders>
      <IonApp>
        {/* F-16: gates the whole app behind the biometric lock when enabled. */}
        <LockGate>
          <IonReactRouter>
            <AppRoutes />
          </IonReactRouter>
        </LockGate>
      </IonApp>
    </AppProviders>
  );
}
