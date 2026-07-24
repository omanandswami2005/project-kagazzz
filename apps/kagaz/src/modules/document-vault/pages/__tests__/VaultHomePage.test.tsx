import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAi } from '@/app/providers/AIProvider';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { i18n, initI18n } from '@/core/i18n';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { useDocuments } from '../../hooks/useDocuments';
import { useUpload } from '../../hooks/useUpload';
import { useVaultMutations } from '../../hooks/useVaultMutations';
import { useVaultStore } from '../../store/vault.store';
import { VaultHomePage } from '../VaultHomePage';
import { VaultHomePageAgent } from '../VaultHomePage.agent';

vi.mock('../../hooks/useDocuments', () => ({ useDocuments: vi.fn() }));
vi.mock('../../hooks/useUpload', () => ({ useUpload: vi.fn() }));
vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
vi.mock('@/app/providers/AIProvider', () => ({ useAi: vi.fn() }));
vi.mock('../../hooks/useVaultMutations', () => ({ useVaultMutations: vi.fn() }));

const useDocumentsMock = vi.mocked(useDocuments);
const useUploadMock = vi.mocked(useUpload);
const useDatabaseMock = vi.mocked(useDatabase);
const useAiMock = vi.mocked(useAi);
const useVaultMutationsMock = vi.mocked(useVaultMutations);

const doc = entityFromNew({
  name: 'Aadhaar',
  filePath: 'documents/doc-1.pdf',
  fileType: 'pdf',
  fileSize: 1234,
  isFavorite: false,
  isLocked: false,
  isArchived: false,
  language: 'en',
  sourceType: 'file_picker',
});

const docB = entityFromNew(
  {
    name: 'PAN Card',
    filePath: 'documents/doc-2.pdf',
    fileType: 'pdf',
    fileSize: 1234,
    isFavorite: false,
    isLocked: false,
    isArchived: false,
    language: 'en',
    sourceType: 'file_picker',
  },
  'doc-2'
);

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  useVaultStore.setState({
    documents: [],
    isLoading: false,
    isUploading: false,
    uploadProgress: null,
    isUploadSheetOpen: false,
    lastUploadErrors: [],
  });
  useDocumentsMock.mockReturnValue({ documents: [], isLoading: false });
  useUploadMock.mockReturnValue({
    isReady: true,
    uploadFrom: vi.fn(() => Promise.resolve({ uploaded: 1, documents: [] })),
    ingestFiles: vi.fn(() => Promise.resolve({ uploaded: 1, documents: [] })),
  });
  useDatabaseMock.mockReturnValue({ status: 'ready', db: null });
  useAiMock.mockReturnValue({
    status: 'not-downloaded',
    downloadProgress: 0,
    errorMessage: null,
    capabilities: null,
    modelSizeBytes: 497_664_000,
    activate: vi.fn(),
    remove: vi.fn(),
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

describe('VaultHomePage', () => {
  it('shows the empty state when the vault has no documents', () => {
    render(<VaultHomePage />);
    // Title now lives in an IonTitle (toolbar), not a semantic <h1>.
    expect(screen.getByText('My Kagazzz')).toBeInTheDocument();
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home"]')
    ).not.toBeNull();
  });

  it('shows the AI chat entry point unless the platform is unsupported (F-13)', () => {
    render(<VaultHomePage />);
    expect(document.querySelector('[data-agent-id="vault.home.ai-chat"]')).toBeInTheDocument();

    useAiMock.mockReturnValue({
      status: 'unsupported',
      downloadProgress: 0,
      errorMessage: null,
      capabilities: null,
      modelSizeBytes: 497_664_000,
      activate: vi.fn(),
      remove: vi.fn(),
    });
    const { container } = render(<VaultHomePage />);
    expect(container.querySelector('[data-agent-id="vault.home.ai-chat"]')).toBeNull();
  });

  it('lists documents when present', () => {
    useDocumentsMock.mockReturnValue({ documents: [doc], isLoading: false });
    render(<VaultHomePage />);
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home.list"]')
    ).toHaveAttribute('data-agent-state', 'success');
  });

  it('opens the upload sheet from the FAB', async () => {
    render(<VaultHomePage />);
    await userEvent.click(
      document.querySelector(
        '[data-agent-id="vault.home.upload-fab"]'
      ) as Element
    );
    expect(useVaultStore.getState().isUploadSheetOpen).toBe(true);
  });

  it('starts the upload when a source is chosen from the sheet', async () => {
    const uploadFrom = vi.fn(() => Promise.resolve({ uploaded: 2, documents: [] }));
    useUploadMock.mockReturnValue({
      isReady: true,
      uploadFrom,
      ingestFiles: vi.fn(() => Promise.resolve({ uploaded: 0, documents: [] })),
    });
    useVaultStore.setState({ isUploadSheetOpen: true });

    render(<VaultHomePage />);
    // A generous explicit timeout: this waits on the ActionSheet's real
    // <dialog> to settle, and CI runners are meaningfully slower than a
    // local machine — the default 1s testing-library timeout has been
    // observed to flake there even though nothing is actually broken.
    await userEvent.click(await screen.findByText('Take a photo', {}, { timeout: 5000 }));
    await waitFor(() => expect(uploadFrom).toHaveBeenCalledWith('camera'));
  });

  it('shows progress while uploading and disables the FAB', () => {
    useVaultStore.setState({
      isUploading: true,
      uploadProgress: {
        currentFile: 1,
        totalFiles: 2,
        fileName: 'a.pdf',
        stage: 'saving',
        progress: 45,
      },
    });
    render(<VaultHomePage />);
    expect(
      document.querySelector('[data-agent-id="vault.home.upload-progress"]')
    ).not.toBeNull();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home.upload-fab"]')
    ).toHaveAttribute('data-agent-state', 'disabled');
  });

  it('shows a visible alert when the database failed to open', () => {
    useDatabaseMock.mockReturnValue({ status: 'error', db: null });
    render(<VaultHomePage />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Secure storage could not start/
    );
  });

  it('surfaces batch failures through the error toast', () => {
    useVaultStore.setState({
      lastUploadErrors: ['upload.errors.file_too_large'],
    });
    render(<VaultHomePage />);
    const toast = document.querySelector(
      '[data-agent-id="vault.home.upload-error-toast"]'
    );
    expect(toast).not.toBeNull();
  });

  it('renames a document from its item menu', async () => {
    const rename = vi.fn().mockResolvedValue(undefined);
    useVaultMutationsMock.mockReturnValue({
      toggleFavorite: vi.fn().mockResolvedValue(undefined),
      setLocked: vi.fn().mockResolvedValue(undefined),
      markAccessed: vi.fn().mockResolvedValue(undefined),
      rename,
      softDelete: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      archive: vi.fn().mockResolvedValue(undefined),
    });
    useDocumentsMock.mockReturnValue({ documents: [doc], isLoading: false });
    render(<VaultHomePage />);

    // fireEvent, not userEvent: the row buttons are zero-sized under jsdom's
    // layout (no real geometry), and userEvent's pointer-target visibility
    // check silently no-ops a click on a zero-sized element.
    const moreButton = document.querySelector(`[data-agent-id="vault.home.item-${doc.id}.more"]`);
    fireEvent.click(moreButton as Element);
    const itemMenu = document.querySelector(
      '[data-agent-id="vault.home.item-menu"]'
    ) as HTMLElement;
    fireEvent.click(within(itemMenu).getByText('Rename'));

    const renamePrompt = document.querySelector(
      '[data-agent-id="vault.home.doc-rename-prompt"]'
    ) as HTMLElement;
    const input = within(renamePrompt).getByLabelText('Document name');
    expect(input).toHaveValue('Aadhaar');
    fireEvent.change(input, { target: { value: 'Aadhaar Card' } });
    fireEvent.click(within(renamePrompt).getByText('Save'));

    expect(rename).toHaveBeenCalledWith(doc, 'Aadhaar Card');
  });

  it('renders in Hindi after a language switch', async () => {
    await i18n.changeLanguage('hi');
    render(<VaultHomePage />);
    expect(screen.getByText('मेरा Kagazzz')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  describe('delete undo queue (bug-audit follow-up)', () => {
    beforeEach(() => {
      // Swipe gesture math needs a real-ish row width; jsdom's real rect is
      // all-zero (same stub used throughout core/gestures' own tests).
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

    // Swipe now only opens a confirm (bug-audit: swipe-to-delete needs a
    // confirm since it's easier to trigger by accident than a menu tap) —
    // this drives the swipe gesture AND confirms it, matching real usage.
    const swipeLeftDelete = (documentId: string): void => {
      const content = document
        .querySelector(`[data-agent-id="vault.home.item-${documentId}.swipe"]`)
        ?.querySelector('.kg-swipe-row__content') as Element;
      fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
      fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      const confirm = document.querySelector(
        '[data-agent-id="vault.home.swipe-delete-confirm"]'
      ) as HTMLElement;
      fireEvent.click(within(confirm).getByText('Delete'));
    };

    it("queues a second delete instead of clobbering the first one's undo", () => {
      const restore = vi.fn().mockResolvedValue(undefined);
      useVaultMutationsMock.mockReturnValue({
        toggleFavorite: vi.fn().mockResolvedValue(undefined),
        setLocked: vi.fn().mockResolvedValue(undefined),
        markAccessed: vi.fn().mockResolvedValue(undefined),
        rename: vi.fn().mockResolvedValue(undefined),
        softDelete: vi.fn().mockResolvedValue(undefined),
        restore,
        archive: vi.fn().mockResolvedValue(undefined),
      });
      useDocumentsMock.mockReturnValue({ documents: [doc, docB], isLoading: false });
      render(<VaultHomePage />);

      // IonToast is a Stencil web component that never hydrates in jsdom —
      // its `message`/`isOpen`/`buttons` land as plain JS properties on the
      // custom element (how @ionic/react's wrapper sets them), not as
      // rendered light-DOM text/children, so this reads those directly
      // rather than screen.getByText (same class of limitation this
      // codebase already documents for IonModal-based sheets).
      const toast = document.querySelector(
        '[data-agent-id="vault.home.delete-toast"]'
      ) as unknown as {
        message?: string;
        isOpen?: boolean;
        buttons?: { text: string; handler?: () => void }[];
      };

      // Swipe-left deletes doc A (the default swipeLeftAction is 'delete').
      swipeLeftDelete(doc.id);
      expect(toast.isOpen).toBe(true);
      expect(toast.message).toBe('Document moved to Trash');

      // Swipe-left deletes doc B before A's toast has been dismissed.
      swipeLeftDelete(docB.id);

      // The toast is still showing (only one ever renders); Undo must still
      // restore A — the queue head — not B, proving B didn't clobber A.
      expect(toast.isOpen).toBe(true);
      const undo = toast.buttons?.find((b) => b.text === 'Undo');
      undo?.handler?.();
      expect(restore).toHaveBeenCalledWith(expect.objectContaining({ id: doc.id }));
      expect(restore).not.toHaveBeenCalledWith(expect.objectContaining({ id: docB.id }));
    });

    it('confirms before deleting, and does nothing on Cancel', () => {
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
      useDocumentsMock.mockReturnValue({ documents: [doc], isLoading: false });
      render(<VaultHomePage />);

      const content = document
        .querySelector(`[data-agent-id="vault.home.item-${doc.id}.swipe"]`)
        ?.querySelector('.kg-swipe-row__content') as Element;
      fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
      fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });

      // The swipe alone must not have deleted anything yet.
      expect(softDelete).not.toHaveBeenCalled();
      const confirm = document.querySelector(
        '[data-agent-id="vault.home.swipe-delete-confirm"]'
      ) as HTMLElement;
      expect(within(confirm).getByText('Delete "Aadhaar"?')).toBeInTheDocument();

      fireEvent.click(within(confirm).getByText('Cancel'));
      expect(softDelete).not.toHaveBeenCalled();
    });
  });
});

describe('VaultHomePage.agent manifest', () => {
  it('declares the page contract', () => {
    expect(VaultHomePageAgent.id).toBe('vault.home');
    expect(VaultHomePageAgent.route).toBe('/vault');
    expect(VaultHomePageAgent.primaryAction?.id).toBe('vault.uploadDocument');
    expect(
      VaultHomePageAgent.availableActions.map((a) => a.id)
    ).toContain('vault.uploadDocument');
    expect(VaultHomePageAgent.voiceExamples?.length).toBeGreaterThan(1);
  });

  it('exposes live observable state from the store', () => {
    useVaultStore.setState({ isUploading: true });
    expect(VaultHomePageAgent.observableState?.['isUploading']?.()).toBe(true);
    expect(VaultHomePageAgent.observableState?.['documentCount']?.()).toBe(0);
    expect(VaultHomePageAgent.observableState?.['isLoading']?.()).toBe(false);
    expect(
      VaultHomePageAgent.observableState?.['isUploadSheetOpen']?.()
    ).toBe(false);
  });

  it('evaluates success predicates over observed counts', () => {
    expect(
      VaultHomePageAgent.successPredicates?.['document added']?.({
        documentCount: 3,
        startCount: 2,
      })
    ).toBe(true);
    expect(
      VaultHomePageAgent.successPredicates?.['upload finished']?.({
        isUploading: false,
      })
    ).toBe(true);
  });
});
