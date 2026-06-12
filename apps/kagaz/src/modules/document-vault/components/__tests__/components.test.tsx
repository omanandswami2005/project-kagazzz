import { IonContent, IonPage } from '@ionic/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { docRow, entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import type {
  DocumentEntity,
  FolderEntity,
} from '@/infrastructure/database/types';
import { DocumentListItem } from '../DocumentListItem';
import { EmptyVaultState } from '../EmptyVaultState';
import { FolderBreadcrumb } from '../FolderBreadcrumb';
import { FolderCard } from '../FolderCard';
import { RecentStrip } from '../RecentStrip';
import { TagSelector } from '../TagSelector';
import { UploadFAB } from '../UploadFAB';
import { UploadOptionsSheet } from '../UploadOptionsSheet';

// TagSelector reaches the DB via useTags; presentational components ignore it.
vi.mock('@/app/providers/DatabaseProvider', () => ({
  useDatabase: () => ({ status: 'error', db: null }),
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
  it('shows name, type badge, size, and agent id', () => {
    render(
      <ul>
        <DocumentListItem document={doc} />
      </ul>
    );
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText(/2\.4\s?MB/)).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home.item-doc-1"]')
    ).not.toBeNull();
  });

  it('falls back to a generic icon for unknown types', () => {
    const odd = { ...doc, fileType: 'zip' };
    render(
      <ul>
        <DocumentListItem document={odd} />
      </ul>
    );
    expect(screen.getByText('ZIP')).toBeInTheDocument();
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
});

const folder: FolderEntity = {
  id: 'f-1',
  name: 'Taxes',
  color: '#10b981',
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
};

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

describe('TagSelector (F-10)', () => {
  it('opens for a document and shows the empty state + create input', async () => {
    render(
      <IonPage>
        <IonContent>
          <TagSelector documentId="doc-1" onDismiss={() => undefined} />
        </IonContent>
      </IonPage>
    );
    expect(await screen.findByText('Tags')).toBeInTheDocument();
    expect(screen.getByText(/No tags yet/)).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home.tag-create"]')
    ).not.toBeNull();
  });

  it('is closed when documentId is null', () => {
    render(
      <IonPage>
        <IonContent>
          <TagSelector documentId={null} onDismiss={() => undefined} />
        </IonContent>
      </IonPage>
    );
    expect(
      document
        .querySelector('[data-agent-id="vault.home.tag-sheet"]')
        ?.getAttribute('data-agent-state')
    ).toBe('collapsed');
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
});

describe('UploadFAB', () => {
  it('invokes onClick and exposes the primary-action agent surface', async () => {
    const onClick = vi.fn();
    render(<UploadFAB onClick={onClick} />);
    const fab = document.querySelector(
      '[data-agent-id="vault.home.upload-fab"]'
    );
    expect(fab).not.toBeNull();
    expect(fab).toHaveAttribute('data-agent-role', 'primary-action');
    expect(fab).toHaveAttribute('data-agent-state', 'idle');
    await userEvent.click(fab as Element);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('reflects the disabled state', () => {
    render(<UploadFAB disabled onClick={() => undefined} />);
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
