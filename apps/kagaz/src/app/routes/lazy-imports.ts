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

export const LazyPdfToolsPage = lazy(
  () => import('@/modules/pdf-engine/pages/PdfToolsPage')
);
