/**
 * Route-level lazy imports (01-system-architecture §Build: every module
 * page loads via React.lazy so V2/V3 chunks never load in a V1 session).
 * Modules append their pages here as their features land.
 */
import { lazy } from 'react';

export const LazyVaultHomePage = lazy(
  () => import('@/modules/document-vault/pages/VaultHomePage')
);

export const LazyFavoritesPage = lazy(
  () => import('@/modules/document-vault/pages/FavoritesPage')
);

export const LazyStoragePage = lazy(
  () => import('@/modules/document-vault/pages/StoragePage')
);

export const LazyTrashPage = lazy(
  () => import('@/modules/document-vault/pages/TrashPage')
);

export const LazyArchivedPage = lazy(
  () => import('@/modules/document-vault/pages/ArchivedPage')
);

export const LazyQuickReferencePage = lazy(
  () => import('@/modules/document-vault/pages/QuickReferencePage')
);

export const LazyQuickNotesPage = lazy(
  () => import('@/modules/document-vault/pages/QuickNotesPage')
);

export const LazyDocumentViewerPage = lazy(
  () => import('@/modules/document-vault/pages/DocumentViewerPage')
);

export const LazyPdfToolsPage = lazy(
  () => import('@/modules/pdf-engine/pages/PdfToolsPage')
);

export const LazySettingsPage = lazy(
  () => import('@/modules/settings/pages/SettingsPage')
);

export const LazyLegalPage = lazy(
  () => import('@/modules/settings/pages/LegalPage')
);

export const LazyAiAssistantPage = lazy(
  () => import('@/modules/ai-assistant/pages/AiAssistantPage')
);

export const LazyChatPage = lazy(
  () => import('@/modules/ai-assistant/pages/ChatPage')
);
