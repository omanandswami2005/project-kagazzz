/**
 * Encrypted-backup export hook (SEC-V1 §8 #11 / F-31). Wires the pure
 * {@link createBackup} core to the live DAOs, filesystem, and secure-storage
 * key, tracks a small status machine for the UI, then best-effort hands the
 * finished `.enc` archive to the OS share sheet.
 *
 * [SEC] User-initiated only — there is no Action Registry entry, so the AI
 * assistant cannot trigger a data export. The archive is written encrypted; the
 * plaintext never leaves memory.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useCallback, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { getOrCreateBackupEncryptionKey } from '@/infrastructure/database/backup-key.provider';
import { DocumentDao, FolderDao } from '@/infrastructure/database/dao';
import { createFileStorage } from '@/infrastructure/filesystem';
import { createBackup, type BackupResult } from '../services/backup.service';

const logger = log('settings');

/** Lifecycle of a single export. */
export type BackupStatus = 'idle' | 'running' | 'done' | 'error';

/** What {@link useBackupExport} exposes. */
export interface UseBackupExport {
  /** Current export status (drives the button + status line). */
  status: BackupStatus;
  /** Result of the last successful export, else null. */
  result: BackupResult | null;
  /** Builds an encrypted archive, then offers the OS share sheet. */
  exportBackup: () => Promise<void>;
}

/** Hands the written archive to the OS share sheet (native only, best-effort). */
async function shareArchive(path: string): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    return;
  }
  const { uri } = await Filesystem.getUri({ directory: Directory.Data, path });
  await Share.share({ title: 'Kagaz backup', url: uri });
}

/** Runs an encrypted-backup export against the live vault. */
export function useBackupExport(): UseBackupExport {
  const { db } = useDatabase();
  const [status, setStatus] = useState<BackupStatus>('idle');
  const [result, setResult] = useState<BackupResult | null>(null);

  const exportBackup = useCallback(async (): Promise<void> => {
    if (!db || status === 'running') {
      return;
    }
    setStatus('running');
    setResult(null);
    try {
      const documentDao = new DocumentDao(db);
      const folderDao = new FolderDao(db);
      const files = createFileStorage();

      const res = await createBackup({
        listDocuments: () => documentDao.findAll(),
        listFolders: () => folderDao.findAll(),
        readFile: (p) => files.read(p),
        writeFile: (p, bytes) => files.write(p, bytes),
        getBackupKey: getOrCreateBackupEncryptionKey,
        now: () => new Date(),
      });

      setResult(res);
      setStatus('done');
      // Delivery is a convenience; a failure here doesn't undo the backup.
      await shareArchive(res.path).catch((err: unknown) => {
        logger.warn({ event: 'settings.backup.share_skipped', err: { message: String(err) } });
      });
    } catch (err) {
      logger.error({ event: 'settings.backup.error', err: { message: String(err) } });
      setStatus('error');
    }
  }, [db, status]);

  return { status, result, exportBackup };
}
