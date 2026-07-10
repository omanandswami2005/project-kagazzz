/**
 * Encrypted local backup export (SEC-V1 §8 #11 / F-31,
 * 10-security-architecture.md §3.4 + §Data Erasure "create a backup first").
 *
 * Packs every non-deleted document (files + a metadata manifest) into a ZIP,
 * then AES-256-GCM-encrypts the whole archive with the platform-held
 * `backup_encryption_key`, writing `backups/kagaz_backup_{stamp}.enc`.
 *
 * [SEC] The archive contains PII, so it is *only ever written encrypted* — the
 * plaintext ZIP never touches disk. The export is user-initiated; nothing here
 * carries an `agentAction`, so the AI assistant cannot exfiltrate the vault.
 * Dependency-injected so the ordering/packaging is unit-testable without native
 * plugins or a real filesystem.
 */
import JSZip from 'jszip';
import { encryptBackup } from '@/core/crypto';
import { log } from '@/core/logging';
import { STORAGE_DIRS } from '@/infrastructure/filesystem';
import type { DocumentEntity, FolderEntity } from '@/infrastructure/database/types';

const logger = log('settings');

/** Self-describing header written into every archive's `manifest.json`. */
export interface BackupManifest {
  /** Discriminator so a restore can reject foreign archives. */
  format: 'kagaz-backup';
  /** Manifest schema version. */
  version: 1;
  /** ISO 8601 creation time. */
  createdAt: string;
  /** Producing app name. */
  app: string;
  /** Quick totals (also lets a restore preview the archive). */
  counts: { documents: number; folders: number };
  /** Full document rows — restored verbatim; files live at each `filePath`. */
  documents: DocumentEntity[];
  /** Full folder rows. */
  folders: FolderEntity[];
}

/** Outcome of a successful {@link createBackup}. */
export interface BackupResult {
  /** App-relative path of the written archive. */
  path: string;
  /** Bare filename (for the share sheet / user-facing message). */
  filename: string;
  /** Encrypted archive size in bytes. */
  sizeBytes: number;
  /** Documents included in the archive. */
  documentCount: number;
  /** `filePath`s whose bytes could not be read (recorded, not fatal). */
  skippedFiles: string[];
}

/** Injectable collaborators for {@link createBackup}. */
export interface BackupDeps {
  /** Every non-deleted document (metadata). */
  listDocuments: () => Promise<DocumentEntity[]>;
  /** Every folder. */
  listFolders: () => Promise<FolderEntity[]>;
  /** Reads a stored file by app-relative path; may reject if missing. */
  readFile: (path: string) => Promise<Uint8Array>;
  /** Writes the encrypted archive. */
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
  /** Resolves the backup encryption key (64 hex chars). */
  getBackupKey: () => Promise<string>;
  /** Clock — injected so the filename is deterministic in tests. */
  now: () => Date;
}

/** Builds the manifest describing an archive's contents (pure). */
export function buildBackupManifest(
  documents: DocumentEntity[],
  folders: FolderEntity[],
  createdAt: string
): BackupManifest {
  return {
    format: 'kagaz-backup',
    version: 1,
    createdAt,
    app: 'Kagaz',
    counts: { documents: documents.length, folders: folders.length },
    documents,
    folders,
  };
}

/** `kagaz_backup_YYYYMMDD-HHmmss.enc` from a Date (UTC, matching `createdAt`). */
export function backupFilename(at: Date): string {
  const p = (n: number, w = 2): string => String(n).padStart(w, '0');
  const stamp =
    `${at.getUTCFullYear()}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}` +
    `-${p(at.getUTCHours())}${p(at.getUTCMinutes())}${p(at.getUTCSeconds())}`;
  return `kagaz_backup_${stamp}.enc`;
}

/**
 * Packs the manifest + document files into a ZIP archive (Uint8Array). Files
 * are stored at their app-relative `filePath` so a restore can write them back
 * verbatim. Unreadable files are skipped and reported, never aborting the run.
 */
export async function packBackupZip(
  manifest: BackupManifest,
  readFile: BackupDeps['readFile']
): Promise<{ zip: Uint8Array; skippedFiles: string[] }> {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const skippedFiles: string[] = [];
  for (const doc of manifest.documents) {
    try {
      const bytes = await readFile(doc.filePath);
      // Copy into this module's realm so JSZip's `instanceof Uint8Array` holds
      // (a jsdom/worker realm boundary can otherwise make the check fail).
      zip.file(doc.filePath, new Uint8Array(bytes));
    } catch {
      // A missing/corrupt file must not strand the whole backup.
      skippedFiles.push(doc.filePath);
    }
  }

  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
  });
  return { zip: zipBytes, skippedFiles };
}

/**
 * Creates an encrypted backup archive and writes it under `backups/`.
 * Throws only if the vault can't be read, the archive can't be encrypted, or
 * the write fails — individual unreadable document files are skipped.
 */
export async function createBackup(deps: BackupDeps): Promise<BackupResult> {
  logger.info({ event: 'settings.backup.start' });

  const [documents, folders] = await Promise.all([
    deps.listDocuments(),
    deps.listFolders(),
  ]);

  const manifest = buildBackupManifest(documents, folders, deps.now().toISOString());
  const { zip, skippedFiles } = await packBackupZip(manifest, deps.readFile);

  const key = await deps.getBackupKey();
  const encrypted = await encryptBackup(zip, key);

  const filename = backupFilename(deps.now());
  const path = `${STORAGE_DIRS.backups}/${filename}`;
  await deps.writeFile(path, encrypted);

  logger.info({
    event: 'settings.backup.success',
    documentCount: documents.length,
    skipped: skippedFiles.length,
    sizeBytes: encrypted.length,
  });

  return {
    path,
    filename,
    sizeBytes: encrypted.length,
    documentCount: documents.length,
    skippedFiles,
  };
}
