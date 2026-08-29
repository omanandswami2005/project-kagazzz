/**
 * Encrypted local backup export + restore (SEC-V1 §8 #11 / F-31,
 * 10-security-architecture.md §3.4 + §Data Erasure "create a backup first",
 * 09-database-design.md §10 Backup & Restore Strategy).
 *
 * Export packs every non-deleted document (files + a metadata manifest) into
 * a ZIP, then AES-256-GCM-encrypts the whole archive with the platform-held
 * `backup_encryption_key`, writing `backups/kagaz_backup_{stamp}.enc`.
 *
 * [SEC] The archive contains PII, so it is *only ever written encrypted* — the
 * plaintext ZIP never touches disk on export, and a decrypted restore's
 * plaintext bytes live only in memory for the duration of the restore.
 * Neither direction carries an `agentAction` — the AI assistant can neither
 * exfiltrate the vault via export nor inject rows via restore.
 *
 * [SEC] Per 09-database-design.md §10's documented design, the backup key
 * stays device-local (secure storage only, never included in the archive —
 * see `backup-key.provider.ts`), so restore is a same-device/same-install
 * recovery mechanism (undo a mistake, recover after data was cleared), not a
 * cross-device migration feature — a backup made on one install cannot be
 * decrypted on another, and `restoreBackup` surfaces that as a clear error
 * rather than a generic failure.
 *
 * Restore is additive by design: it creates new rows/files alongside
 * whatever already exists (fresh ids, fresh `filePath`s — the pipeline
 * `UploadService.processFile` also uses) rather than wiping the vault first,
 * so a wrong-file mistake never destroys current data. Folders are restored
 * parent-first so a child's remapped `parentId` is always available.
 * Thumbnails aren't in the archive (09-database-design.md §10's own "Backup
 * Contents" table) and aren't regenerated here either — same graceful-degrade
 * a document already gets when a thumbnail attempt fails.
 *
 * Dependency-injected throughout so ordering/packaging/restore-application is
 * unit-testable without native plugins or a real filesystem.
 */
import JSZip from 'jszip';
import { decryptBackup, encryptBackup } from '@/core/crypto';
import { log } from '@/core/logging';
import { STORAGE_DIRS } from '@/infrastructure/filesystem';
import type {
  DocumentEntity,
  FolderEntity,
  NewDocument,
  NewFolder,
} from '@/infrastructure/database/types';

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
  /**
   * Full document rows as they were at export time; the zip entry for each
   * lives at its `filePath`. A restore preserves every field except
   * `id`/`filePath`/timestamps (see {@link applyBackup}), so this is
   * "verbatim content, fresh identity" rather than a byte-for-byte replay.
   */
  documents: DocumentEntity[];
  /** Full folder rows (same "verbatim content, fresh identity" restore). */
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

/** A decrypted, parsed archive — ready to preview (counts) or apply. */
export interface ParsedBackup {
  manifest: BackupManifest;
  zip: JSZip;
}

/**
 * Decrypts an `.enc` container and parses its manifest. Throws a specific,
 * user-facing-safe message for each distinct failure — [SEC] deliberately
 * distinguishes "wrong key" (near-certainly a different device/install, see
 * this file's own doc comment) from "not a Kagaz archive at all", since a
 * generic "restore failed" leaves the user unable to tell whether retrying
 * (e.g. after re-picking the right file) could possibly help.
 */
export async function decryptAndParseBackup(
  container: Uint8Array,
  keyHex: string
): Promise<ParsedBackup> {
  let plain: Uint8Array;
  try {
    plain = await decryptBackup(container, keyHex);
  } catch {
    throw new Error(
      'Could not decrypt this backup — it may be from a different device/install, or the file is corrupted.'
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(plain);
  } catch {
    throw new Error('Backup archive is corrupted.');
  }
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) {
    throw new Error('Not a Kagaz backup file.');
  }
  const manifest = JSON.parse(await manifestEntry.async('string')) as Partial<BackupManifest>;
  if (manifest.format !== 'kagaz-backup') {
    throw new Error('Not a Kagaz backup file.');
  }
  if (manifest.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(manifest.version)}.`);
  }
  return { manifest: manifest as BackupManifest, zip };
}

/**
 * Orders folders so every parent precedes its children — required before
 * remapping `parentId` to freshly-created ids, one pass at a time. A
 * dangling/cyclic `parentId` (never producible by the live schema's own FK
 * constraint, but a hand-edited or foreign manifest could have one) isn't
 * silently dropped — the still-blocked remainder is appended as if it were
 * root-level, so nothing from the archive is ever lost to a malformed chain.
 */
function orderFoldersParentFirst(folders: FolderEntity[]): FolderEntity[] {
  const placed = new Set<string>();
  const ordered: FolderEntity[] = [];
  let remaining = folders;
  while (remaining.length > 0) {
    const ready = remaining.filter((f) => !f.parentId || placed.has(f.parentId));
    if (ready.length === 0) {
      ordered.push(...remaining);
      break;
    }
    ready.forEach((f) => placed.add(f.id));
    ordered.push(...ready);
    remaining = remaining.filter((f) => !placed.has(f.id));
  }
  return ordered;
}

/** Outcome of applying a parsed backup to the live vault. */
export interface RestoreResult {
  restoredFolders: number;
  restoredDocuments: number;
  /** Names of documents whose file bytes were missing from the archive or
   * failed to persist — recorded, not fatal, same posture as export's
   * `skippedFiles`. */
  skippedDocuments: string[];
}

/** Injectable collaborators for {@link applyBackup}. */
export interface RestoreDeps {
  createFolder: (folder: NewFolder) => Promise<FolderEntity>;
  createDocument: (doc: NewDocument) => Promise<DocumentEntity>;
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
}

/**
 * Applies a parsed backup to the live vault — additive, never destructive
 * (see this file's own doc comment). Every folder/document gets a fresh id
 * (via `deps.createFolder`/`createDocument`) and every document's file gets
 * a fresh `filePath`, mirroring `UploadService.processFile`'s own naming so
 * restored files are indistinguishable from freshly-uploaded ones.
 */
export async function applyBackup(
  { manifest, zip }: ParsedBackup,
  deps: RestoreDeps
): Promise<RestoreResult> {
  logger.info({
    event: 'settings.backup.restore.start',
    documentCount: manifest.documents.length,
    folderCount: manifest.folders.length,
  });

  const folderIdMap = new Map<string, string>();
  for (const folder of orderFoldersParentFirst(manifest.folders)) {
    const created = await deps.createFolder({
      name: folder.name,
      parentId: folder.parentId ? folderIdMap.get(folder.parentId) : undefined,
      icon: folder.icon,
      color: folder.color,
      sortOrder: folder.sortOrder,
    });
    folderIdMap.set(folder.id, created.id);
  }

  const skippedDocuments: string[] = [];
  let restoredDocuments = 0;
  for (const doc of manifest.documents) {
    const entry = zip.file(doc.filePath);
    if (!entry) {
      skippedDocuments.push(doc.name);
      continue;
    }
    try {
      const bytes = await entry.async('uint8array');
      const filePath = `${STORAGE_DIRS.documents}/${crypto.randomUUID()}.${doc.fileType}`;
      // Copy into this module's realm — same reasoning as packBackupZip's
      // own `new Uint8Array(bytes)` (a jsdom/worker realm boundary can
      // otherwise make a downstream `instanceof Uint8Array` check fail).
      await deps.writeFile(filePath, new Uint8Array(bytes));
      await deps.createDocument({
        name: doc.name,
        description: doc.description,
        filePath,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        fileHash: doc.fileHash,
        thumbnailPath: undefined,
        folderId: doc.folderId ? folderIdMap.get(doc.folderId) : undefined,
        isFavorite: doc.isFavorite,
        isLocked: doc.isLocked,
        isArchived: doc.isArchived,
        language: doc.language,
        ocrText: doc.ocrText,
        sourceType: doc.sourceType,
        originalFilename: doc.originalFilename,
        metadataJson: doc.metadataJson,
      });
      restoredDocuments += 1;
    } catch (error) {
      skippedDocuments.push(doc.name);
      logger.warn({
        event: 'settings.backup.restore.document_failed',
        err: { message: String(error) },
      });
    }
  }

  logger.info({
    event: 'settings.backup.restore.success',
    restoredDocuments,
    restoredFolders: folderIdMap.size,
    skipped: skippedDocuments.length,
  });

  return { restoredFolders: folderIdMap.size, restoredDocuments, skippedDocuments };
}
