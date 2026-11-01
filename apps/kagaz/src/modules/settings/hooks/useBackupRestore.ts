/**
 * Encrypted-backup restore hook (SEC-V1 §8 #11 / F-31, the restore
 * counterpart to {@link useBackupExport}). Two explicit phases so the user
 * sees what a `.enc` file actually contains before anything is written:
 * `pickBackup()` opens a file picker, decrypts, and parses the manifest
 * (nothing persisted yet); `confirmRestore()` applies it. `cancel()` discards
 * a previewed archive without touching the vault.
 *
 * [SEC] User-initiated only — there is no Action Registry entry, so the AI
 * assistant cannot inject rows into the vault via restore. See
 * `backup.service.ts`'s own doc comment for why restore only ever works
 * against a backup made on this same device/install.
 */
import { useCallback, useRef, useState } from 'react';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { log } from '@/core/logging';
import { getOrCreateBackupEncryptionKey } from '@/infrastructure/database/backup-key.provider';
import { DocumentDao, FolderDao } from '@/infrastructure/database/dao';
import { createFileStorage } from '@/infrastructure/filesystem';
import {
  applyBackup,
  decryptAndParseBackup,
  type BackupManifest,
  type ParsedBackup,
  type RestoreResult,
} from '../services/backup.service';

const logger = log('settings');

/** Lifecycle of a single restore. */
export type RestoreStatus = 'idle' | 'reading' | 'confirming' | 'running' | 'done' | 'error';

/** What {@link useBackupRestore} exposes. */
export interface UseBackupRestore {
  /** Current restore status (drives the button + confirm UI). */
  status: RestoreStatus;
  /** Once a picked archive is decrypted+parsed, its manifest — for a preview
   * ("Restore 12 documents, 3 folders?") before anything is written. */
  preview: BackupManifest | null;
  /** Result of the last successful restore, else null. */
  result: RestoreResult | null;
  /** User-facing message for the last failure, else null. */
  error: string | null;
  /** Opens the file picker, decrypts + parses the chosen archive. */
  pickBackup: () => Promise<void>;
  /** Applies the previewed archive to the live vault. */
  confirmRestore: () => Promise<void>;
  /** Discards a preview without applying it. */
  cancel: () => void;
}

/** Opens a native file picker restricted to `.enc` backup archives. */
function pickBackupFile(doc: Document = document): Promise<File | null> {
  return new Promise((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = '.enc';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      resolve(file);
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    doc.body.appendChild(input);
    input.click();
  });
}

/** Runs an encrypted-backup restore against the live vault. */
export function useBackupRestore(): UseBackupRestore {
  const { db } = useDatabase();
  const [status, setStatus] = useState<RestoreStatus>('idle');
  const [preview, setPreview] = useState<BackupManifest | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Holds the decrypted-but-not-yet-applied archive between pickBackup() and
  // confirmRestore() — not exposed, since the caller only needs its manifest
  // for the preview.
  const parsedRef = useRef<ParsedBackup | null>(null);

  const cancel = useCallback((): void => {
    parsedRef.current = null;
    setPreview(null);
    setStatus('idle');
  }, []);

  const pickBackup = useCallback(async (): Promise<void> => {
    if (status === 'reading' || status === 'running') {
      return;
    }
    const file = await pickBackupFile();
    if (!file) {
      return; // Cancelled — stay wherever the user was.
    }
    setStatus('reading');
    setError(null);
    setResult(null);
    try {
      const container = new Uint8Array(await file.arrayBuffer());
      const key = await getOrCreateBackupEncryptionKey();
      const parsed = await decryptAndParseBackup(container, key);
      parsedRef.current = parsed;
      setPreview(parsed.manifest);
      setStatus('confirming');
    } catch (err) {
      logger.error({ event: 'settings.backup.restore.parse_failed', err: { message: String(err) } });
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [status]);

  const confirmRestore = useCallback(async (): Promise<void> => {
    const parsed = parsedRef.current;
    if (!db || !parsed || status !== 'confirming') {
      return;
    }
    setStatus('running');
    try {
      const res = await applyBackup(parsed, {
        createFolder: (f) => new FolderDao(db).create(f),
        createDocument: (d) => new DocumentDao(db).create(d),
        writeFile: (p, bytes) => createFileStorage().write(p, bytes),
      });
      parsedRef.current = null;
      setPreview(null);
      setResult(res);
      setStatus('done');
    } catch (err) {
      logger.error({ event: 'settings.backup.restore.error', err: { message: String(err) } });
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [db, status]);

  return { status, preview, result, error, pickBackup, confirmRestore, cancel };
}
