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
import { paperTransition } from './shell/paper-transition';

// One design on every platform (audit G-9): Material — left-aligned titles,
// arrow-only back, 48 px toolbar targets. The app is Android-first and our
// tokens already define every surface, so iOS mode would only re-centre
// titles and add "Back" labels.
// Pages move like sheets of paper (device feedback 2026-11-19).
setupIonicReact({ mode: 'md', navAnimation: paperTransition });

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
