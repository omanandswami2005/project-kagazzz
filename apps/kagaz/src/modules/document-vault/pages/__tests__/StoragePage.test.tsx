import { render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { useAi } from '@/app/providers/AIProvider';
import { useStorageStats } from '../../hooks/useStorageStats';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { StoragePage } from '../StoragePage';
import { StoragePageAgent } from '../StoragePage.agent';

vi.mock('../../hooks/useStorageStats', () => ({ useStorageStats: vi.fn() }));
vi.mock('@/app/providers/AIProvider', () => ({ useAi: vi.fn() }));
const useStorageStatsMock = vi.mocked(useStorageStats);
const useAiMock = vi.mocked(useAi);

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  useAiMock.mockReturnValue({
    status: 'not-downloaded',
    downloadProgress: 0,
    errorMessage: null,
    capabilities: null,
    engine: 'litert' as const,
    serverUrl: null,
    modelSizeBytes: 497_664_000,
    preferGpu: false,
    setPreferGpu: vi.fn(),
    activate: vi.fn(),
    remove: vi.fn(),
  });
});

describe('StoragePage (F-26)', () => {
  it('shows a loading state until stats arrive', () => {
    useStorageStatsMock.mockReturnValue({ stats: null });
    render(<StoragePage />);
    expect(
      document.querySelector('[data-agent-id="vault.storage.loading"]')
    ).not.toBeNull();
  });

  it('renders totals, type breakdown, duplicates, and largest', () => {
    useStorageStatsMock.mockReturnValue({
      stats: {
        totalBytes: 10 * 1024 * 1024,
        documentCount: 5,
        byType: [{ fileType: 'pdf', bytes: 8 * 1024 * 1024, count: 3, fraction: 0.8 }],
        largest: [
          entityFromNew(
            {
              name: 'Huge Scan',
              filePath: 'documents/huge.pdf',
              fileType: 'pdf',
              fileSize: 8 * 1024 * 1024,
              isFavorite: false,
              isLocked: false,
              isArchived: false,
              language: 'en',
              sourceType: 'file_picker',
            },
            'huge'
          ),
        ],
        duplicateGroups: 2,
        reclaimableBytes: 1024 * 1024,
      },
    });
    render(<StoragePage />);
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Huge Scan')).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.storage.duplicates"]')
    ).not.toBeNull();
  });

  it('declares a read-only page manifest', () => {
    expect(StoragePageAgent.id).toBe('vault.storage');
    expect(StoragePageAgent.route).toBe('/storage');
    expect(StoragePageAgent.availableActions).toEqual([]);
  });

  describe('AI model row (F-13/F-26)', () => {
    beforeEach(() => {
      useStorageStatsMock.mockReturnValue({
        stats: {
          totalBytes: 10 * 1024 * 1024,
          documentCount: 5,
          byType: [],
          largest: [],
          duplicateGroups: 0,
          reclaimableBytes: 0,
        },
      });
    });

    it('hides the AI model row when no model is loaded', () => {
      render(<StoragePage />);
      expect(document.querySelector('[data-agent-id="vault.storage.ai-model"]')).toBeNull();
    });

    it('shows the model size and a manage link once the model is ready', () => {
      useAiMock.mockReturnValue({
        status: 'ready',
        downloadProgress: 100,
        errorMessage: null,
        capabilities: { backend: 'gpu', loadTimeMs: 900 },
        engine: 'litert' as const,
        serverUrl: null,
        modelSizeBytes: 497_664_000,
        preferGpu: false,
        setPreferGpu: vi.fn(),
        activate: vi.fn(),
        remove: vi.fn(),
      });
      render(<StoragePage />);
      expect(document.querySelector('[data-agent-id="vault.storage.ai-model"]')).not.toBeNull();
      expect(screen.getByText('AI model')).toBeInTheDocument();
      expect(
        document.querySelector('[data-agent-id="vault.storage.ai-model.manage"]')
      ).not.toBeNull();
    });
  });
});
