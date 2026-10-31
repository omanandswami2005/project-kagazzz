import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import {
  MemoryFileStorage,
  docRow,
  incoming,
  pdfBytes,
} from '../../__tests__/fixtures/vault-fixtures';
import { pickFiles } from '../../services/upload-sources';
import { UploadService } from '../../services/upload.service';
import { useVaultStore } from '../../store/vault.store';
import { useUpload } from '../useUpload';

vi.mock('@/app/providers/DatabaseProvider', () => ({
  useDatabase: vi.fn(),
}));

// Auto-extraction after upload is exercised in useDocumentOcr's own tests.
const ocr = vi.hoisted(() => ({ extractText: vi.fn(), canExtract: true }));
vi.mock('../useDocumentOcr', () => ({
  canExtractText: () => ocr.canExtract,
  useDocumentOcr: () => ({ runningId: null, extractText: ocr.extractText }),
}));

vi.mock('../../services/upload-sources', () => ({
  pickFiles: vi.fn(),
}));

const storage = new MemoryFileStorage();
vi.mock('@/infrastructure/filesystem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/filesystem')>()),
  createFileStorage: (): MemoryFileStorage => storage,
}));

const useDatabaseMock = vi.mocked(useDatabase);
const pickFilesMock = vi.mocked(pickFiles);

beforeEach(() => {
  ocr.canExtract = false;
  ocr.extractText.mockReset().mockResolvedValue(null);
  storage.files.clear();
  useVaultStore.setState({
    documents: [],
    isLoading: false,
    isUploading: false,
    uploadProgress: null,
    isUploadSheetOpen: true,
    lastUploadErrors: [],
    folderPath: [],
  });
});

describe('useUpload', () => {
  it('is not ready without a database', async () => {
    useDatabaseMock.mockReturnValue({ status: 'error', db: null });
    const { result } = renderHook(() => useUpload());
    expect(result.current.isReady).toBe(false);
    await expect(result.current.uploadFrom('files')).resolves.toMatchObject({
      uploaded: 0,
    });
  });

  it('uploads picked files and updates the store', async () => {
    const db = new FakeDb().onQuery(/SELECT \* FROM documents WHERE id = \?/, [docRow()]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    pickFilesMock.mockResolvedValue([incoming('Aadhaar.pdf', pdfBytes())]);

    const { result } = renderHook(() => useUpload());
    expect(result.current.isReady).toBe(true);

    await act(async () => {
      await expect(result.current.uploadFrom('files')).resolves.toMatchObject({
        uploaded: 1,
      });
    });

    const state = useVaultStore.getState();
    expect(state.isUploadSheetOpen).toBe(false);
    expect(state.documents).toHaveLength(1);
    expect(state.isUploading).toBe(false);
    expect(state.lastUploadErrors).toEqual([]);
    expect(storage.files.size).toBe(1);
  });

  it('reads the text of each uploaded document in the background', async () => {
        ocr.canExtract = true;
    const db = new FakeDb().onQuery(/SELECT \* FROM documents WHERE id = \?/, [docRow()]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    pickFilesMock.mockResolvedValue([incoming('Rover card.pdf', pdfBytes())]);

    const { result } = renderHook(() => useUpload());
    await act(async () => {
      await result.current.uploadFrom('files');
    });
    await vi.waitFor(() => expect(ocr.extractText).toHaveBeenCalledOnce());
  });

  it('uploads into the current folder so the doc persists there', async () => {
    const db = new FakeDb().onQuery(/SELECT \* FROM documents WHERE id = \?/, [docRow()]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    pickFilesMock.mockResolvedValue([incoming('In Folder.pdf', pdfBytes())]);
    useVaultStore.setState({
      folderPath: [{ id: 'fld-1', name: 'Taxes', sortOrder: 0, createdAt: '', updatedAt: '' }],
    });

    const { result } = renderHook(() => useUpload());
    await act(async () => {
      await result.current.uploadFrom('files');
    });

    const insert = db.calls.find(
      (c) => c.kind === 'run' && c.sql.includes('INSERT INTO documents')
    );
    // folder_id (9th value) carries the current folder, not null.
    expect(insert?.params).toContain('fld-1');
  });

  it('records per-file failures as error message keys', async () => {
    const db = new FakeDb().onQuery(/SELECT \* FROM documents WHERE id = \?/, [docRow()]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    pickFilesMock.mockResolvedValue([incoming('nope.exe', pdfBytes())]);

    const { result } = renderHook(() => useUpload());
    await act(async () => {
      await expect(result.current.uploadFrom('files')).resolves.toMatchObject({
        uploaded: 0,
      });
    });

    expect(useVaultStore.getState().lastUploadErrors).toEqual(['upload.errors.invalid_file_type']);
  });

  it('does nothing when the picker is cancelled', async () => {
    const db = new FakeDb();
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    pickFilesMock.mockResolvedValue([]);

    const { result } = renderHook(() => useUpload());
    await act(async () => {
      await expect(result.current.uploadFrom('camera')).resolves.toMatchObject({
        uploaded: 0,
      });
    });
    expect(useVaultStore.getState().isUploading).toBe(false);
  });

  it('propagates picker failures without starting an upload', async () => {
    const db = new FakeDb();
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    pickFilesMock.mockRejectedValue(new Error('picker exploded'));

    const { result } = renderHook(() => useUpload());
    await expect(result.current.uploadFrom('gallery')).rejects.toThrow('picker exploded');
    expect(useVaultStore.getState().isUploading).toBe(false);
  });

  it('finishes with a generic error key when the batch crashes', async () => {
    const db = new FakeDb();
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    pickFilesMock.mockResolvedValue([incoming('a.pdf', pdfBytes())]);
    vi.spyOn(UploadService.prototype, 'uploadFiles').mockRejectedValue(new Error('batch crashed'));

    const { result } = renderHook(() => useUpload());
    await expect(result.current.uploadFrom('files')).rejects.toThrow('batch crashed');
    const state = useVaultStore.getState();
    expect(state.isUploading).toBe(false);
    expect(state.lastUploadErrors).toEqual(['upload.errors.file_read_error']);
  });
});
