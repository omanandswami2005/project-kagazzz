import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { docRow } from '../../__tests__/fixtures/vault-fixtures';
import { useVaultStore } from '../../store/vault.store';
import { useDocuments } from '../useDocuments';

vi.mock('@/app/providers/DatabaseProvider', () => ({
  useDatabase: vi.fn(),
}));

const useDatabaseMock = vi.mocked(useDatabase);

beforeEach(() => {
  useVaultStore.setState({
    documents: [],
    isLoading: false,
    isUploading: false,
    uploadProgress: null,
    isUploadSheetOpen: false,
    lastUploadErrors: [],
  });
});

describe('useDocuments', () => {
  it('loads root documents into the store once the db is ready', async () => {
    const db = new FakeDb().onQuery(/folder_id IS NULL/, [
      docRow({ id: 'doc-1' }),
      docRow({ id: 'doc-2', name: 'PAN' }),
    ]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.documents).toHaveLength(2));
    expect(result.current.isLoading).toBe(false);
    // Store sorts on set (default createdAt desc; equal createdAt → id desc),
    // so doc-2/PAN precedes doc-1/Aadhaar.
    expect(result.current.documents.map((d) => d.name)).toEqual([
      'PAN',
      'Aadhaar',
    ]);
  });

  it('stays empty without a database connection', () => {
    useDatabaseMock.mockReturnValue({ status: 'opening', db: null });
    const { result } = renderHook(() => useDocuments());
    expect(result.current.documents).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('logs and clears loading when the query fails', async () => {
    const db = new FakeDb();
    db.query = vi.fn(() => Promise.reject(new Error('SQLITE_CORRUPT')));
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useDocuments());
    await waitFor(() =>
      expect(useVaultStore.getState().isLoading).toBe(false)
    );
    expect(result.current.documents).toEqual([]);
  });
});
