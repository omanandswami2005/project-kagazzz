import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { i18n, initI18n } from '@/core/i18n';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { useDocuments } from '../../hooks/useDocuments';
import { useUpload } from '../../hooks/useUpload';
import { useVaultStore } from '../../store/vault.store';
import { VaultHomePage } from '../VaultHomePage';
import { VaultHomePageAgent } from '../VaultHomePage.agent';

vi.mock('../../hooks/useDocuments', () => ({ useDocuments: vi.fn() }));
vi.mock('../../hooks/useUpload', () => ({ useUpload: vi.fn() }));
vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));

const useDocumentsMock = vi.mocked(useDocuments);
const useUploadMock = vi.mocked(useUpload);
const useDatabaseMock = vi.mocked(useDatabase);

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
});

describe('VaultHomePage', () => {
  it('shows the empty state when the vault has no documents', () => {
    render(<VaultHomePage />);
    // Title now lives in an IonTitle (toolbar), not a semantic <h1>.
    expect(screen.getByText('My Documents')).toBeInTheDocument();
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home"]')
    ).not.toBeNull();
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
    await userEvent.click(await screen.findByText('Take a photo'));
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

  it('renders in Hindi after a language switch', async () => {
    await i18n.changeLanguage('hi');
    render(<VaultHomePage />);
    expect(screen.getByText('मेरे दस्तावेज़')).toBeInTheDocument();
    await i18n.changeLanguage('en');
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
