/**
 * Route tree (P0-10). react-router v5 (Ionic peer requirement — never
 * bump, see ADR/Dependency Version Policy). Guards (auth/version) arrive
 * with F-16.
 *
 * Wrapped in a bottom tab bar (Documents / Favorites / Storage). '/'
 * redirects to '/vault' via <Redirect> (history.replace, so it adds no
 * stack entry — the earlier back-loop came from a *pushing* redirect);
 * the canonical '/vault' path is what lets the Documents tab highlight
 * on cold start.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  useIonRouter,
  useIonToast,
} from '@ionic/react';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Redirect, Route } from 'react-router-dom';
import { Icon, Spinner } from '@kagaz/ui';
import {
  LazyAiAssistantPage,
  LazyArchivedPage,
  LazyFavoritesPage,
  LazyLegalPage,
  LazyPdfToolsPage,
  LazyDocumentViewerPage,
  LazyQuickNotesPage,
  LazyQuickReferencePage,
  LazySettingsPage,
  LazyStoragePage,
  LazyTrashPage,
  LazyVaultHomePage,
} from './lazy-imports';

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

/**
 * Top-level shell: a bottom tab bar (Documents / Favorites / Tools /
 * Storage) wrapping the router outlet. IonTabs reserves the tab bar's
 * height and safe-area inset itself, so each tab's IonContent scrolls
 * *above* the bar — nothing renders behind it. '/' redirects to the
 * Documents tab so that tab highlights on cold start (Redirect replaces,
 * no extra history entry — the hardware-back handler above still owns the
 * root exit).
 *
 * Tools moved here from a VaultHomePage header button (UX pass,
 * 2026-07-23, user-requested) — one tap from anywhere instead of only from
 * the vault home header, and consistent with Favorites/Storage already
 * being tab-only rather than also duplicated as header buttons.
 */
export function AppRoutes(): ReactNode {
  useHardwareBack();
  const { t } = useTranslation('common');
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Suspense fallback={<Spinner size="lg" label="Loading..." />}>
          <Route exact path="/vault" component={LazyVaultHomePage} />
          <Route exact path="/pdf-tools" component={LazyPdfToolsPage} />
          <Route exact path="/settings" component={LazySettingsPage} />
          <Route exact path="/legal/:doc" component={LazyLegalPage} />
          <Route exact path="/trash" component={LazyTrashPage} />
          <Route exact path="/archived" component={LazyArchivedPage} />
          <Route exact path="/ai-assistant" component={LazyAiAssistantPage} />
          <Route
            exact
            path="/quick-reference"
            component={LazyQuickReferencePage}
          />
          <Route exact path="/quick-notes" component={LazyQuickNotesPage} />
          <Route exact path="/doc/:id" component={LazyDocumentViewerPage} />
          <Route exact path="/favorites" component={LazyFavoritesPage} />
          <Route exact path="/storage" component={LazyStoragePage} />
          <Route exact path="/">
            <Redirect to="/vault" />
          </Route>
        </Suspense>
      </IonRouterOutlet>
      <IonTabBar slot="bottom" data-agent-id="app.tab-bar">
        <IonTabButton tab="vault" href="/vault" data-agent-id="app.tab.documents">
          <Icon name="Folder" size={24} aria-hidden />
          <IonLabel>{t('tabs.documents')}</IonLabel>
        </IonTabButton>
        <IonTabButton
          tab="favorites"
          href="/favorites"
          data-agent-id="app.tab.favorites"
        >
          <Icon name="Star" size={24} aria-hidden />
          <IonLabel>{t('tabs.favorites')}</IonLabel>
        </IonTabButton>
        <IonTabButton
          tab="tools"
          href="/pdf-tools"
          data-agent-id="app.tab.tools"
        >
          <Icon name="FileText" size={24} aria-hidden />
          <IonLabel>{t('tabs.tools')}</IonLabel>
        </IonTabButton>
        <IonTabButton
          tab="storage"
          href="/storage"
          data-agent-id="app.tab.storage"
        >
          <Icon name="HardDrive" size={24} aria-hidden />
          <IonLabel>{t('tabs.storage')}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
