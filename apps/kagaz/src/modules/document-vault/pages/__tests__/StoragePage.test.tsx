import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { useStorageStats } from '../../hooks/useStorageStats';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { StoragePage } from '../StoragePage';
import { StoragePageAgent } from '../StoragePage.agent';

vi.mock('../../hooks/useStorageStats', () => ({ useStorageStats: vi.fn() }));
const useStorageStatsMock = vi.mocked(useStorageStats);

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
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
});
