/**
 * Root component (P0-10): Ionic app shell + providers + routes.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonApp, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useEffect, type ReactNode } from 'react';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './routes';

setupIonicReact();

/** Routes that are the app's root screen — hardware back exits there. */
const ROOT_PATHS = ['/', '/vault'];

/**
 * Android hardware back: Ionic walks the router history; this lowest-
 * priority handler runs when there is nowhere left to go and sends the
 * app to the background (home screen) instead of doing nothing.
 */
function useHardwareBackButton(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }
    const onBack = (event: Event): void => {
      const detail = (
        event as CustomEvent<{
          register: (priority: number, handler: () => void) => void;
        }>
      ).detail;
      detail.register(-1, () => {
        if (ROOT_PATHS.includes(window.location.pathname)) {
          void CapacitorApp.minimizeApp();
        } else {
          window.history.back();
        }
      });
    };
    document.addEventListener('ionBackButton', onBack);
    return (): void => document.removeEventListener('ionBackButton', onBack);
  }, []);
}

/** The Kagaz application. */
export function App(): ReactNode {
  useHardwareBackButton();
  return (
    <AppProviders>
      <IonApp>
        <IonReactRouter>
          <AppRoutes />
        </IonReactRouter>
      </IonApp>
    </AppProviders>
  );
}
