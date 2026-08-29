import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackupManifest, RestoreResult } from '../../services/backup.service';

const { decryptAndParseBackup, applyBackup, useDatabase } = vi.hoisted(() => ({
  decryptAndParseBackup: vi.fn(),
  applyBackup: vi.fn(),
  useDatabase: vi.fn(),
}));

vi.mock('../../services/backup.service', () => ({ decryptAndParseBackup, applyBackup }));
vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase }));
vi.mock('@/infrastructure/database/backup-key.provider', () => ({
  getOrCreateBackupEncryptionKey: vi.fn(async () => 'a'.repeat(64)),
}));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    create = vi.fn();
  },
  FolderDao: class {
    create = vi.fn();
  },
}));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ write: vi.fn() }),
}));

import { useBackupRestore } from '../useBackupRestore';

const MANIFEST: BackupManifest = {
  format: 'kagaz-backup',
  version: 1,
  createdAt: '2026-07-10T00:00:00.000Z',
  app: 'Kagaz',
  counts: { documents: 2, folders: 1 },
  documents: [],
  folders: [],
};

const RESULT: RestoreResult = {
  restoredFolders: 1,
  restoredDocuments: 2,
  skippedDocuments: [],
};

/** Stubs `<input type="file">` so pickBackup() resolves without a real picker. */
function stubFilePicker(file: File | null): void {
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementationOnce((tag: string) => {
    const el = realCreateElement(tag);
    if (tag === 'input') {
      queueMicrotask(() => {
        if (file) {
          Object.defineProperty(el, 'files', { value: [file], configurable: true });
          el.dispatchEvent(new Event('change'));
        } else {
          el.dispatchEvent(new Event('cancel'));
        }
      });
    }
    return el;
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  decryptAndParseBackup.mockReset();
  applyBackup.mockReset();
  useDatabase.mockReturnValue({ db: {}, status: 'ready' });
});

describe('useBackupRestore (SEC-V1 #11)', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useBackupRestore());
    expect(result.current.status).toBe('idle');
    expect(result.current.preview).toBeNull();
  });

  it('parses a picked archive into a preview without applying it', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'kagaz_backup.enc');
    decryptAndParseBackup.mockResolvedValue({ manifest: MANIFEST, zip: {} });
    const { result } = renderHook(() => useBackupRestore());

    stubFilePicker(file);
    await act(async () => {
      await result.current.pickBackup();
    });

    expect(result.current.status).toBe('confirming');
    expect(result.current.preview).toEqual(MANIFEST);
    expect(applyBackup).not.toHaveBeenCalled();
  });

  it('stays idle when the file picker is cancelled', async () => {
    const { result } = renderHook(() => useBackupRestore());

    stubFilePicker(null);
    await act(async () => {
      await result.current.pickBackup();
    });

    expect(result.current.status).toBe('idle');
    expect(decryptAndParseBackup).not.toHaveBeenCalled();
  });

  it('surfaces a clear error when the archive fails to decrypt/parse', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'kagaz_backup.enc');
    decryptAndParseBackup.mockRejectedValue(
      new Error('Could not decrypt this backup — it may be from a different device/install.')
    );
    const { result } = renderHook(() => useBackupRestore());

    stubFilePicker(file);
    await act(async () => {
      await result.current.pickBackup();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/different device/);
    expect(result.current.preview).toBeNull();
  });

  it('applies the previewed archive on confirmRestore', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'kagaz_backup.enc');
    decryptAndParseBackup.mockResolvedValue({ manifest: MANIFEST, zip: {} });
    applyBackup.mockResolvedValue(RESULT);
    const { result } = renderHook(() => useBackupRestore());

    stubFilePicker(file);
    await act(async () => {
      await result.current.pickBackup();
    });
    await act(async () => {
      await result.current.confirmRestore();
    });

    expect(result.current.status).toBe('done');
    expect(result.current.result).toEqual(RESULT);
    expect(result.current.preview).toBeNull();
  });

  it('cancel() discards the preview without applying anything', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'kagaz_backup.enc');
    decryptAndParseBackup.mockResolvedValue({ manifest: MANIFEST, zip: {} });
    const { result } = renderHook(() => useBackupRestore());

    stubFilePicker(file);
    await act(async () => {
      await result.current.pickBackup();
    });
    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.preview).toBeNull();
    expect(applyBackup).not.toHaveBeenCalled();
  });

  it('surfaces an error when applying the backup fails', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'kagaz_backup.enc');
    decryptAndParseBackup.mockResolvedValue({ manifest: MANIFEST, zip: {} });
    applyBackup.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useBackupRestore());

    stubFilePicker(file);
    await act(async () => {
      await result.current.pickBackup();
    });
    await act(async () => {
      await result.current.confirmRestore();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('disk full');
    expect(result.current.result).toBeNull();
  });

  it('is a no-op without a database connection', async () => {
    useDatabase.mockReturnValue({ db: null, status: 'loading' });
    const file = new File([new Uint8Array([1, 2, 3])], 'kagaz_backup.enc');
    decryptAndParseBackup.mockResolvedValue({ manifest: MANIFEST, zip: {} });
    const { result } = renderHook(() => useBackupRestore());

    stubFilePicker(file);
    await act(async () => {
      await result.current.pickBackup();
    });
    await act(async () => {
      await result.current.confirmRestore();
    });

    expect(result.current.status).toBe('confirming');
    expect(applyBackup).not.toHaveBeenCalled();
  });
});
