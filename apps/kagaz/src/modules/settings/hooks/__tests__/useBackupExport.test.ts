import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackupResult } from '../../services/backup.service';

const { createBackup, useDatabase, share, getUri } = vi.hoisted(() => ({
  createBackup: vi.fn(),
  useDatabase: vi.fn(),
  share: vi.fn(),
  getUri: vi.fn(),
}));

vi.mock('../../services/backup.service', () => ({ createBackup }));
vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase }));
vi.mock('@/infrastructure/database/backup-key.provider', () => ({
  getOrCreateBackupEncryptionKey: vi.fn(async () => 'a'.repeat(64)),
}));
vi.mock('@/infrastructure/database/dao', () => ({
  DocumentDao: class {
    findAll = vi.fn(async () => []);
  },
  FolderDao: class {
    findAll = vi.fn(async () => []);
  },
}));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read: vi.fn(), write: vi.fn() }),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: { getUri: getUri },
}));
vi.mock('@capacitor/share', () => ({ Share: { share } }));

import { useBackupExport } from '../useBackupExport';

const RESULT: BackupResult = {
  path: 'backups/kagaz_backup_20260710-093507.enc',
  filename: 'kagaz_backup_20260710-093507.enc',
  sizeBytes: 128,
  documentCount: 3,
  skippedFiles: [],
};

beforeEach(() => {
  createBackup.mockReset();
  share.mockReset();
  getUri.mockReset().mockResolvedValue({ uri: 'file:///data/backups/x.enc' });
  useDatabase.mockReturnValue({ db: {}, status: 'ready' });
});

describe('useBackupExport (SEC-V1 #11)', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useBackupExport());
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
  });

  it('runs to done and shares the written archive', async () => {
    createBackup.mockResolvedValue(RESULT);
    const { result } = renderHook(() => useBackupExport());

    await act(async () => {
      await result.current.exportBackup();
    });

    expect(result.current.status).toBe('done');
    expect(result.current.result).toEqual(RESULT);
    expect(getUri).toHaveBeenCalledWith({ directory: 'DATA', path: RESULT.path });
    expect(share).toHaveBeenCalledWith({ title: 'Kagaz backup', url: 'file:///data/backups/x.enc' });
  });

  it('still reports done when the share sheet fails', async () => {
    createBackup.mockResolvedValue(RESULT);
    share.mockRejectedValue(new Error('user cancelled'));
    const { result } = renderHook(() => useBackupExport());

    await act(async () => {
      await result.current.exportBackup();
    });

    expect(result.current.status).toBe('done');
    expect(result.current.result).toEqual(RESULT);
  });

  it('surfaces an error when the backup fails', async () => {
    createBackup.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useBackupExport());

    await act(async () => {
      await result.current.exportBackup();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.result).toBeNull();
    expect(share).not.toHaveBeenCalled();
  });

  it('is a no-op without a database connection', async () => {
    useDatabase.mockReturnValue({ db: null, status: 'loading' });
    const { result } = renderHook(() => useBackupExport());

    await act(async () => {
      await result.current.exportBackup();
    });

    expect(result.current.status).toBe('idle');
    expect(createBackup).not.toHaveBeenCalled();
  });
});
