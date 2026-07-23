import { render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { useFavorites } from '../../hooks/useFavorites';
import { useTags } from '../../hooks/useTags';
import { useVaultMutations } from '../../hooks/useVaultMutations';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { FavoritesPage } from '../FavoritesPage';
import { FavoritesPageAgent } from '../FavoritesPage.agent';

vi.mock('../../hooks/useFavorites', () => ({ useFavorites: vi.fn() }));
vi.mock('../../hooks/useTags', () => ({ useTags: vi.fn() }));
vi.mock('../../hooks/useVaultMutations', () => ({
  useVaultMutations: vi.fn(),
}));

const useFavoritesMock = vi.mocked(useFavorites);
const useTagsMock = vi.mocked(useTags);
const useVaultMutationsMock = vi.mocked(useVaultMutations);

const favDoc = entityFromNew(
  {
    name: 'Starred Scan',
    filePath: 'documents/star.pdf',
    fileType: 'pdf',
    fileSize: 1024,
    isFavorite: true,
    isLocked: false,
    isArchived: false,
    language: 'en',
    sourceType: 'file_picker',
  },
  'fav-1'
);

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  useTagsMock.mockReturnValue({
    tags: [],
    tagsByDocument: new Map(),
    createTag: vi.fn(),
    assignTag: vi.fn(),
    removeTag: vi.fn(),
  });
  useVaultMutationsMock.mockReturnValue({
    toggleFavorite: vi.fn().mockResolvedValue(undefined),
    setLocked: vi.fn().mockResolvedValue(undefined),
    markAccessed: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
    unarchive: vi.fn().mockResolvedValue(undefined),
  });
});

describe('FavoritesPage (F-33)', () => {
  it('shows the empty state when nothing is starred', () => {
    useFavoritesMock.mockReturnValue({ favorites: [], isLoading: false });
    render(<FavoritesPage />);
    expect(
      document.querySelector('[data-agent-id="vault.favorites.empty"]')
    ).not.toBeNull();
    expect(screen.getByText('No favorites yet')).toBeInTheDocument();
  });

  it('lists starred documents', () => {
    useFavoritesMock.mockReturnValue({ favorites: [favDoc], isLoading: false });
    render(<FavoritesPage />);
    expect(screen.getByText('Starred Scan')).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.favorites.list"]')
    ).not.toBeNull();
  });

  it('declares a manifest exposing only the favorite toggle', () => {
    expect(FavoritesPageAgent.id).toBe('vault.favorites');
    expect(FavoritesPageAgent.route).toBe('/favorites');
    expect(FavoritesPageAgent.availableActions).toHaveLength(1);
  });
});
