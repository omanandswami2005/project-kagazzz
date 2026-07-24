import { fireEvent, render, screen, within } from '@testing-library/react';
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

  describe('swipe-to-delete confirmation (bug-audit follow-up)', () => {
    beforeEach(() => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 300,
        height: 56,
        top: 0,
        left: 0,
        right: 300,
        bottom: 56,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    it('confirms before calling softDelete', () => {
      const softDelete = vi.fn().mockResolvedValue(undefined);
      useVaultMutationsMock.mockReturnValue({
        toggleFavorite: vi.fn().mockResolvedValue(undefined),
        setLocked: vi.fn().mockResolvedValue(undefined),
        markAccessed: vi.fn().mockResolvedValue(undefined),
        rename: vi.fn().mockResolvedValue(undefined),
        softDelete,
        restore: vi.fn().mockResolvedValue(undefined),
        archive: vi.fn().mockResolvedValue(undefined),
      });
      useFavoritesMock.mockReturnValue({ favorites: [favDoc], isLoading: false });
      render(<FavoritesPage />);

      const content = document
        .querySelector(`[data-agent-id="vault.home.item-${favDoc.id}.swipe"]`)
        ?.querySelector('.kg-swipe-row__content') as Element;
      fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
      fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });

      expect(softDelete).not.toHaveBeenCalled();
      const confirm = document.querySelector(
        '[data-agent-id="vault.favorites.swipe-delete-confirm"]'
      ) as HTMLElement;
      expect(within(confirm).getByText('Delete "Starred Scan"?')).toBeInTheDocument();

      fireEvent.click(within(confirm).getByText('Delete'));
      expect(softDelete).toHaveBeenCalledWith(expect.objectContaining({ id: favDoc.id }));
    });
  });
});
