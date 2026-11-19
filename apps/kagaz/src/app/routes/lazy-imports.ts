/**
 * Route-level lazy imports (01-system-architecture §Build: every module
 * page loads via React.lazy so V2/V3 chunks never load in a V1 session).
 * Modules append their pages here as their features land.
 */
import { createElement, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Spinner } from '@kagaz/ui';

/**
 * A lazily loaded page with its own Suspense boundary. Each `<Route>` must be a
 * direct child of `IonRouterOutlet` — Ionic builds its page stack from them.
 * One Suspense around all routes hid them from Ionic: every navigation
 * unmounted and re-mounted the page (home re-loaded each time) and no page
 * transition ran (device feedback 2026-11-19).
 */
function lazyPage(load: () => Promise<{ default: ComponentType }>): ComponentType {
  const Page = lazy(load);
  function SuspendedPage(): ReactNode {
    return createElement(
      Suspense,
      { fallback: createElement(Spinner, { size: 'lg', label: 'Loading...' }) },
      createElement(Page)
    );
  }
  return SuspendedPage;
}

export const LazyVaultHomePage = lazyPage(
  () => import('@/modules/document-vault/pages/VaultHomePage')
);

export const LazyFavoritesPage = lazyPage(
  () => import('@/modules/document-vault/pages/FavoritesPage')
);

export const LazyStoragePage = lazyPage(
  () => import('@/modules/document-vault/pages/StoragePage')
);

export const LazyTrashPage = lazyPage(
  () => import('@/modules/document-vault/pages/TrashPage')
);

export const LazyArchivedPage = lazyPage(
  () => import('@/modules/document-vault/pages/ArchivedPage')
);

export const LazyQuickReferencePage = lazyPage(
  () => import('@/modules/document-vault/pages/QuickReferencePage')
);

export const LazyQuickNotesPage = lazyPage(
  () => import('@/modules/document-vault/pages/QuickNotesPage')
);

export const LazyDocumentViewerPage = lazyPage(
  () => import('@/modules/document-vault/pages/DocumentViewerPage')
);

export const LazyPdfToolsPage = lazyPage(
  () => import('@/modules/pdf-engine/pages/PdfToolsPage')
);

export const LazySettingsPage = lazyPage(
  () => import('@/modules/settings/pages/SettingsPage')
);

export const LazyLegalPage = lazyPage(
  () => import('@/modules/settings/pages/LegalPage')
);

export const LazyAiAssistantPage = lazyPage(
  () => import('@/modules/ai-assistant/pages/AiAssistantPage')
);

export const LazyChatPage = lazyPage(
  () => import('@/modules/ai-assistant/pages/ChatPage')
);
