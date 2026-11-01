import { IonContent, IonPage } from '@ionic/react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { docRow, entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import type {
  DocumentEntity,
  FolderEntity,
  TagEntity,
} from '@/infrastructure/database/types';
import { EMPTY_FILTERS } from '../../services/filter.service';
import { BulkActionBar } from '../BulkActionBar';
import { DocumentListItem } from '../DocumentListItem';
import { EmptyVaultState } from '../EmptyVaultState';
import { FilterPanel } from '../FilterPanel';
import { FolderBreadcrumb } from '../FolderBreadcrumb';
import { FolderCard } from '../FolderCard';
import { FolderColorPicker } from '../FolderColorPicker';
import { RecentStrip } from '../RecentStrip';
import { TagSelector } from '../TagSelector';
import { UploadFAB } from '../UploadFAB';
import { UploadOptionsSheet } from '../UploadOptionsSheet';

// TagSelector reaches the DB via useTags; presentational components ignore it.
vi.mock('@/app/providers/DatabaseProvider', () => ({
  useDatabase: () => ({ status: 'error', db: null }),
}));

// DocumentListItem loads thumbnails via useThumbnail (F-24); control it here.
const thumbnailUrl = vi.fn<() => string | null>(() => null);
vi.mock('../../hooks/useThumbnail', () => ({
  useThumbnail: () => thumbnailUrl(),
}));

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

const doc: DocumentEntity = entityFromNew({
  name: 'Aadhaar',
  filePath: 'documents/doc-1.pdf',
  fileType: 'pdf',
  fileSize: 2_560_000,
  isFavorite: false,
  isLocked: false,
  isArchived: false,
  language: 'en',
  sourceType: 'file_picker',
});

describe('DocumentListItem', () => {
  it('shows name and a muted type · size · date meta line, and agent id (UX-5)', () => {
    render(
      <ul>
        <DocumentListItem document={doc} />
      </ul>
    );
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    const meta = document.querySelector('.kg-doc-item__meta');
    expect(meta?.textContent).toContain('PDF');
    expect(meta?.textContent).toMatch(/2\.4\s?MB/);
    expect(
      document.querySelector('[data-agent-id="vault.home.item-doc-1"]')
    ).not.toBeNull();
  });

  it('renders a short type label for unknown/MIME types', () => {
    const odd = { ...doc, fileType: 'application/zip' };
    render(
      <ul>
        <DocumentListItem document={odd} />
      </ul>
    );
    expect(document.querySelector('.kg-doc-item__meta')?.textContent).toContain('ZIP');
  });

  it('renders a cached thumbnail image when available (F-24)', () => {
    thumbnailUrl.mockReturnValueOnce('blob:thumb-1');
    render(
      <ul>
        <DocumentListItem document={{ ...doc, thumbnailPath: 'thumbnails/a.jpg' }} />
      </ul>
    );
    const img = document.querySelector('img.kg-doc-item__thumb');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'blob:thumb-1');
  });

  it('renders assigned tag chips and an overflow menu button (F-10/F-9)', async () => {
    const onMore = vi.fn();
    render(
      <ul>
        <DocumentListItem
          document={doc}
          tags={[
            { id: 't-1', name: 'Government', color: '#3b82f6', createdAt: '' },
          ]}
          onMore={onMore}
        />
      </ul>
    );
    expect(screen.getByText('Government')).toBeInTheDocument();
    await userEvent.click(
      document.querySelector(
        '[data-agent-id="vault.home.item-doc-1.more"]'
      ) as Element
    );
    expect(onMore).toHaveBeenCalledWith(doc);
  });

  it('shows a favorite star and reports toggles (F-33)', async () => {
    const onToggleFavorite = vi.fn();
    render(
      <ul>
        <DocumentListItem document={doc} onToggleFavorite={onToggleFavorite} />
      </ul>
    );
    const star = document.querySelector(
      '[data-agent-id="vault.home.item-doc-1.favorite"]'
    );
    expect(star).not.toBeNull();
    expect(star).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(star as Element);
    expect(onToggleFavorite).toHaveBeenCalledWith(doc);
  });

  it('reflects the favorited state on the star', () => {
    render(
      <ul>
        <DocumentListItem
          document={{ ...doc, isFavorite: true }}
          onToggleFavorite={() => undefined}
        />
      </ul>
    );
    expect(
      document.querySelector('[data-agent-id="vault.home.item-doc-1.favorite"]')
    ).toHaveAttribute('aria-pressed', 'true');
  });

  // interaction-patterns.md "Long-press (500ms)" — enter selection mode.
  describe('long-press (F-25)', () => {
    afterEach(() => vi.useRealTimers());

    it('enters selection after holding 500ms on a touch pointer', () => {
      vi.useFakeTimers();
      const onLongPress = vi.fn();
      const onOpen = vi.fn();
      render(
        <ul>
          <DocumentListItem document={doc} onOpen={onOpen} onLongPress={onLongPress} />
        </ul>
      );
      const row = document.querySelector('[data-agent-id="vault.home.item-doc-1"]') as Element;
      fireEvent.pointerDown(row, { pointerType: 'touch' });
      vi.advanceTimersByTime(500);
      expect(onLongPress).toHaveBeenCalledWith(doc);
      fireEvent.click(row);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('does not fire on a short tap, and the tap still opens the document', () => {
      vi.useFakeTimers();
      const onLongPress = vi.fn();
      const onOpen = vi.fn();
      render(
        <ul>
          <DocumentListItem document={doc} onOpen={onOpen} onLongPress={onLongPress} />
        </ul>
      );
      const row = document.querySelector('[data-agent-id="vault.home.item-doc-1"]') as Element;
      fireEvent.pointerDown(row, { pointerType: 'touch' });
      vi.advanceTimersByTime(200);
      fireEvent.pointerUp(row, { pointerType: 'touch' });
      vi.advanceTimersByTime(500);
      expect(onLongPress).not.toHaveBeenCalled();
      fireEvent.click(row);
      expect(onOpen).toHaveBeenCalledWith(doc);
    });

    it('is a no-op while already in selection mode', () => {
      vi.useFakeTimers();
      const onLongPress = vi.fn();
      const onToggleSelect = vi.fn();
      render(
        <ul>
          <DocumentListItem
            document={doc}
            selectionMode
            onToggleSelect={onToggleSelect}
            onLongPress={onLongPress}
          />
        </ul>
      );
      const row = document.querySelector('[data-agent-id="vault.home.item-doc-1"]') as Element;
      fireEvent.pointerDown(row, { pointerType: 'touch' });
      vi.advanceTimersByTime(500);
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('ignores mouse pointers (touch-only per interaction-patterns.md)', () => {
      vi.useFakeTimers();
      const onLongPress = vi.fn();
      render(
        <ul>
          <DocumentListItem document={doc} onLongPress={onLongPress} />
        </ul>
      );
      const row = document.querySelector('[data-agent-id="vault.home.item-doc-1"]') as Element;
      fireEvent.pointerDown(row, { pointerType: 'mouse' });
      vi.advanceTimersByTime(500);
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('tolerates small finger drift (real touchscreens can\'t hold perfectly still)', () => {
      vi.useFakeTimers();
      const onLongPress = vi.fn();
      render(
        <ul>
          <DocumentListItem document={doc} onOpen={vi.fn()} onLongPress={onLongPress} />
        </ul>
      );
      const row = document.querySelector('[data-agent-id="vault.home.item-doc-1"]') as Element;
      fireEvent.pointerDown(row, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
      // A few pixels of drift — within tolerance, must not cancel the hold.
      fireEvent.pointerMove(row, { pointerType: 'touch', pointerId: 1, clientX: 104, clientY: 102 });
      vi.advanceTimersByTime(500);
      expect(onLongPress).toHaveBeenCalledWith(doc);
    });

    it('cancels the hold once drift exceeds the scroll-intent threshold', () => {
      vi.useFakeTimers();
      const onLongPress = vi.fn();
      render(
        <ul>
          <DocumentListItem document={doc} onOpen={vi.fn()} onLongPress={onLongPress} />
        </ul>
      );
      const row = document.querySelector('[data-agent-id="vault.home.item-doc-1"]') as Element;
      fireEvent.pointerDown(row, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
      // Well past the tolerance — reads as a scroll, not a long-press.
      fireEvent.pointerMove(row, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 140 });
      vi.advanceTimersByTime(500);
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('clears a pending timer on unmount so it never fires on a stale document', () => {
      vi.useFakeTimers();
      const onLongPress = vi.fn();
      const { unmount } = render(
        <ul>
          <DocumentListItem document={doc} onOpen={vi.fn()} onLongPress={onLongPress} />
        </ul>
      );
      const row = document.querySelector('[data-agent-id="vault.home.item-doc-1"]') as Element;
      fireEvent.pointerDown(row, { pointerType: 'touch' });
      // The row disappears mid-press (list re-sort/filter/refresh) without a
      // pointerup/cancel ever reaching this instance.
      unmount();
      vi.advanceTimersByTime(500);
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });
});

describe('RecentStrip (F-32)', () => {
  it('renders nothing when there are no recent documents', () => {
    const { container } = render(
      <RecentStrip documents={[]} onOpen={() => undefined} />
    );
    expect(container.querySelector('[data-agent-id="vault.home.recent"]')).toBeNull();
  });

  it('lists recent documents and reports opens', async () => {
    const onOpen = vi.fn();
    render(<RecentStrip documents={[doc]} onOpen={onOpen} />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
    await userEvent.click(
      document.querySelector(
        '[data-agent-id="vault.home.recent-doc-1"]'
      ) as Element
    );
    expect(onOpen).toHaveBeenCalledWith(doc);
  });

  it('shows a thumbnail in the recent card when one exists (F-24)', () => {
    thumbnailUrl.mockReturnValueOnce('blob:recent-thumb');
    const { container } = render(
      <RecentStrip
        documents={[{ ...doc, thumbnailPath: 'thumbnails/r.jpg' }]}
        onOpen={() => undefined}
      />
    );
    const img = container.querySelector('img.kg-recent__thumb');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:recent-thumb');
  });
});

const folder: FolderEntity = {
  id: 'f-1',
  name: 'Taxes',
  color: '#10b981',
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
};

describe('BulkActionBar (F-25)', () => {
  it('shows the count and fires favorite/cancel', async () => {
    const onFavorite = vi.fn();
    const onCancel = vi.fn();
    render(
      <BulkActionBar
        count={3}
        onCancel={onCancel}
        onDelete={() => undefined}
        onMove={() => undefined}
        onFavorite={onFavorite}
      />
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    await userEvent.click(
      document.querySelector('[data-agent-id="vault.home.bulk-favorite"]') as Element
    );
    expect(onFavorite).toHaveBeenCalledOnce();
    await userEvent.click(
      document.querySelector('[data-agent-id="vault.home.bulk-cancel"]') as Element
    );
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables actions when nothing is selected', () => {
    render(
      <BulkActionBar
        count={0}
        onCancel={() => undefined}
        onDelete={() => undefined}
        onMove={() => undefined}
        onFavorite={() => undefined}
      />
    );
    expect(
      document.querySelector('[data-agent-id="vault.home.bulk-delete"]')
    ).toBeDisabled();
  });
});

describe('FilterPanel (F-12)', () => {
  it('toggles a kind chip and applies the draft', async () => {
    const onApply = vi.fn();
    render(
      <IonPage>
        <IonContent>
          <FilterPanel
            isOpen
            filters={EMPTY_FILTERS}
            tags={[]}
            onDismiss={() => undefined}
            onApply={onApply}
          />
        </IonContent>
      </IonPage>
    );
    await userEvent.click(await screen.findByText('PDF'));
    await userEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['pdf'] })
    );
  });

  it('clear resets and applies empty filters', async () => {
    const onApply = vi.fn();
    render(
      <IonPage>
        <IonContent>
          <FilterPanel
            isOpen
            filters={{ ...EMPTY_FILTERS, favoritesOnly: true }}
            tags={[]}
            onDismiss={() => undefined}
            onApply={onApply}
          />
        </IonContent>
      </IonPage>
    );
    await userEvent.click(await screen.findByText('Clear all'));
    expect(onApply).toHaveBeenCalledWith(EMPTY_FILTERS);
  });
});

describe('FolderCard (F-9)', () => {
  it('opens the folder on click', async () => {
    const onOpen = vi.fn();
    render(<FolderCard folder={folder} onOpen={onOpen} />);
    expect(screen.getByText('Taxes')).toBeInTheDocument();
    await userEvent.click(
      document.querySelector('[data-agent-id="vault.home.folder-f-1"]') as Element
    );
    expect(onOpen).toHaveBeenCalledWith(folder);
  });

  it('hides the overflow button when onMore is omitted', () => {
    render(<FolderCard folder={folder} onOpen={() => undefined} />);
    expect(
      document.querySelector('[data-agent-id="vault.home.folder-f-1.more"]')
    ).toBeNull();
  });

  it('opens folder options without also opening the folder', async () => {
    const onOpen = vi.fn();
    const onMore = vi.fn();
    render(<FolderCard folder={folder} onOpen={onOpen} onMore={onMore} />);
    await userEvent.click(
      document.querySelector('[data-agent-id="vault.home.folder-f-1.more"]') as Element
    );
    expect(onMore).toHaveBeenCalledWith(folder);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('FolderBreadcrumb (F-9)', () => {
  it('renders nothing at the root', () => {
    const { container } = render(
      <FolderBreadcrumb path={[]} onNavigate={() => undefined} />
    );
    expect(container.querySelector('[data-agent-id="vault.home.breadcrumb"]')).toBeNull();
  });

  it('shows the path and navigates to a depth', async () => {
    const onNavigate = vi.fn();
    render(<FolderBreadcrumb path={[folder]} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByText('Taxes'));
    expect(onNavigate).toHaveBeenCalledWith(1);
    await userEvent.click(
      document.querySelector('[data-agent-id="vault.home.breadcrumb-root"]') as Element
    );
    expect(onNavigate).toHaveBeenCalledWith(0);
  });
});

describe('FolderColorPicker (F-9)', () => {
  // Same leaked-open-modal caveat as TagSelector's tests: run the closed
  // assertion first, before any open instance exists in this suite to leak.

  it('is closed when folder is null', () => {
    render(
      <IonPage>
        <IonContent>
          <FolderColorPicker folder={null} onDismiss={() => undefined} onSelect={() => undefined} />
        </IonContent>
      </IonPage>
    );
    expect(
      document
        .querySelector('[data-agent-id="vault.home.folder-color-sheet"]')
        ?.getAttribute('data-agent-state')
    ).toBe('collapsed');
  });

  it('marks the folder\'s current color as pressed and reports a swatch pick', async () => {
    const onSelect = vi.fn();
    render(
      <IonPage>
        <IonContent>
          <FolderColorPicker
            folder={{ ...folder, color: '#3b82f6' }}
            onDismiss={() => undefined}
            onSelect={onSelect}
          />
        </IonContent>
      </IonPage>
    );
    expect(await screen.findByText('Choose a color')).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home.folder-color-3b82f6"]')
    ).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(
      document.querySelector('[data-agent-id="vault.home.folder-color-ef4444"]') as Element
    );
    expect(onSelect).toHaveBeenCalledWith('#ef4444');
  });

  it('reports null when the default swatch is picked', async () => {
    const onSelect = vi.fn();
    render(
      <IonPage>
        <IonContent>
          <FolderColorPicker
            folder={{ ...folder, color: '#3b82f6' }}
            onDismiss={() => undefined}
            onSelect={onSelect}
          />
        </IonContent>
      </IonPage>
    );
    await userEvent.click(
      await screen.findByLabelText('Default color')
    );
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

const noTagsProps = {
  tags: [],
  tagsByDocument: new Map<string, TagEntity[]>(),
  createTag: vi.fn(),
  assignTag: vi.fn(),
  removeTag: vi.fn(),
};

describe('TagSelector (F-10)', () => {
  // Ionic's ion-modal physically relocates its content to <body> once open,
  // and React's unmount doesn't reliably reclaim a node a web component
  // moved outside the tree it originally rendered into — so a *closed*
  // modal's own element can't be told apart from a previous test's leaked,
  // still-open one via a `document`-wide query. Run the "closed" assertion
  // first, before any open-modal instance exists in this suite to leak.

  it('is closed when documentId is null', () => {
    render(
      <IonPage>
        <IonContent>
          <TagSelector documentId={null} onDismiss={() => undefined} {...noTagsProps} />
        </IonContent>
      </IonPage>
    );
    expect(
      document
        .querySelector('[data-agent-id="vault.home.tag-sheet"]')
        ?.getAttribute('data-agent-state')
    ).toBe('collapsed');
  });

  it('opens for a document and shows the empty state + create input', async () => {
    render(
      <IonPage>
        <IonContent>
          <TagSelector documentId="doc-1" onDismiss={() => undefined} {...noTagsProps} />
        </IonContent>
      </IonPage>
    );
    expect(await screen.findByText('Tags')).toBeInTheDocument();
    expect(screen.getByText(/No tags yet/)).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home.tag-create"]')
    ).not.toBeNull();
  });

  it('toggling a tag calls the shared assignTag prop (not a private useTags instance)', async () => {
    const assignTag = vi.fn();
    const tag: TagEntity = { id: 't-1', name: 'Government', createdAt: '' };
    render(
      <IonPage>
        <IonContent>
          <TagSelector
            documentId="doc-1"
            onDismiss={() => undefined}
            {...noTagsProps}
            tags={[tag]}
            assignTag={assignTag}
          />
        </IonContent>
      </IonPage>
    );
    await userEvent.click(await screen.findByText('Government'));
    expect(assignTag).toHaveBeenCalledWith('doc-1', 't-1');
  });
});

describe('EmptyVaultState', () => {
  it('renders the localized empty copy', () => {
    render(<EmptyVaultState />);
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Scan or upload your first document/)
    ).toBeInTheDocument();
  });

  it('offers the starter-folders CTA when wired (F-30)', async () => {
    const onSetUpFolders = vi.fn();
    render(<EmptyVaultState onSetUpFolders={onSetUpFolders} />);
    await userEvent.click(
      document.querySelector('[data-agent-id="vault.home.setup-folders"]') as Element
    );
    expect(onSetUpFolders).toHaveBeenCalledOnce();
  });
});

describe('UploadFAB', () => {
  // UX pass 2026-07-25: the main button now opens a 3-item speed-dial
  // (Upload / New Folder / Quick Note) instead of firing the upload sheet
  // directly — see UploadFAB.tsx for why (Ionic's ion-fab-button toggles any
  // sibling ion-fab-list on every click, main or child).
  it('opening the drawer exposes the primary-action agent surface, and the Upload item invokes onUpload', async () => {
    const onUpload = vi.fn();
    const onNewFolder = vi.fn();
    const onQuickNote = vi.fn();
    render(
      <UploadFAB
        onUpload={onUpload}
        onNewFolder={onNewFolder}
        onQuickNote={onQuickNote}
      />
    );
    const fab = document.querySelector(
      '[data-agent-id="vault.home.upload-fab"]'
    );
    expect(fab).not.toBeNull();
    expect(fab).toHaveAttribute('data-agent-role', 'primary-action');
    expect(fab).toHaveAttribute('data-agent-state', 'idle');

    await userEvent.click(fab as Element);
    await userEvent.click(
      document.querySelector(
        '[data-agent-id="vault.home.upload-fab-upload"]'
      ) as Element
    );
    expect(onUpload).toHaveBeenCalledOnce();
    expect(onNewFolder).not.toHaveBeenCalled();
    expect(onQuickNote).not.toHaveBeenCalled();
  });

  it('the New Folder and Quick Note items invoke their own handlers', async () => {
    const onNewFolder = vi.fn();
    const onQuickNote = vi.fn();
    render(
      <UploadFAB
        onUpload={() => undefined}
        onNewFolder={onNewFolder}
        onQuickNote={onQuickNote}
      />
    );
    const fab = document.querySelector(
      '[data-agent-id="vault.home.upload-fab"]'
    ) as Element;

    await userEvent.click(fab);
    await userEvent.click(
      document.querySelector(
        '[data-agent-id="vault.home.upload-fab-new-folder"]'
      ) as Element
    );
    expect(onNewFolder).toHaveBeenCalledOnce();

    // The drawer auto-collapses on the item click above (Ionic toggles on
    // every fab-button click in the group) — re-open it for the second item.
    await userEvent.click(fab);
    await userEvent.click(
      document.querySelector(
        '[data-agent-id="vault.home.upload-fab-quick-note"]'
      ) as Element
    );
    expect(onQuickNote).toHaveBeenCalledOnce();
  });

  it('reflects the disabled state', () => {
    render(
      <UploadFAB
        disabled
        onUpload={() => undefined}
        onNewFolder={() => undefined}
        onQuickNote={() => undefined}
      />
    );
    expect(
      document.querySelector('[data-agent-id="vault.home.upload-fab"]')
    ).toHaveAttribute('data-agent-state', 'disabled');
  });
});

describe('UploadOptionsSheet', () => {
  it('lists the three sources and reports the chosen one', async () => {
    const onSelect = vi.fn();
    render(
      <IonPage>
        <IonContent>
          <UploadOptionsSheet
            isOpen
            onDismiss={() => undefined}
            onSelect={onSelect}
          />
        </IonContent>
      </IonPage>
    );
    expect(await screen.findByText('Take a photo')).toBeInTheDocument();
    expect(screen.getByText('Browse files')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Choose from gallery'));
    expect(onSelect).toHaveBeenCalledWith('gallery');
  });
});

// Sanity: the snake_case fixture row matches the entity used above.
describe('fixtures', () => {
  it('docRow exposes the DAO column shape', () => {
    expect(docRow()['file_type']).toBe('pdf');
  });
});
