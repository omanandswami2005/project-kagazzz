/**
 * Root component (P0-10): Ionic app shell + providers + routes.
 */
import { IonApp, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import type { ReactNode } from 'react';
import { LockGate } from '@/modules/auth/components/LockGate';
import { RootWarningBanner } from '@/modules/auth/components/RootWarningBanner';
import { OnboardingGate } from './onboarding/OnboardingGate';
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
          {/* SEC-V1 #10: rooted-device warning (dismissible, non-blocking). */}
          <RootWarningBanner />
          {/* F-27: first-launch walkthrough overlay (renders once, then null). */}
          <OnboardingGate />
          <IonReactRouter>
            <AppRoutes />
          </IonReactRouter>
        </LockGate>
      </IonApp>
    </AppProviders>
  );
}
