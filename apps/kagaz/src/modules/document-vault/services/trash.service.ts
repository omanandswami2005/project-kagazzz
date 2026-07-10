/**
 * Trash / Recycle Bin lifecycle (F-57, 02-document-vault-module.md).
 *
 * Deleting a document soft-deletes it (a `deleted_at` timestamp); it then lives
 * in the Trash for a retention window before being purged for good. This module
 * owns permanent removal — deleting the stored files *and* the row — plus the
 * 30-day auto-purge.
 *
 * [LEGAL] The retention window caps how long "deleted" data lingers on-device:
 * a user deletion request is fully honoured within {@link TRASH_RETENTION_DAYS}
 * (docs/indian-compliance-checklist.md — deletion ≤30 days). Dependency-injected
 * so ordering + expiry are unit-testable without native storage.
 */
import { log } from '@/core/logging';
import type { DbConnection } from '@/infrastructure/database/connection';
import { DocumentDao } from '@/infrastructure/database/dao';
import type { DocumentEntity } from '@/infrastructure/database/types';
import type { FileStorage } from '@/infrastructure/filesystem';

const logger = log('document-vault');

/** Days a soft-deleted document is retained before automatic purge. */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Injectable collaborators for the trash operations. */
export interface TrashDeps {
  /** Every soft-deleted document. */
  listTrashed: () => Promise<DocumentEntity[]>;
  /** Permanently removes a (trashed) document row. */
  hardDelete: (id: string) => Promise<number>;
  /** Deletes a stored file by app-relative path (idempotent). */
  deleteFile: (path: string) => Promise<void>;
  /** Current time in ms (injected for deterministic expiry in tests). */
  now: () => number;
}

/** Wires {@link TrashDeps} to the live DAO + filesystem (used by the launch
 *  purge and the Trash page). */
export function createTrashDeps(db: DbConnection, files: FileStorage): TrashDeps {
  const dao = new DocumentDao(db);
  return {
    listTrashed: () => dao.findTrashed(),
    hardDelete: (id) => dao.hardDelete(id),
    deleteFile: (path) => files.delete(path),
    now: () => Date.now(),
  };
}

/** True when a document has been in the Trash beyond the retention window. */
export function isExpired(
  deletedAt: string | undefined,
  nowMs: number,
  retentionDays = TRASH_RETENTION_DAYS
): boolean {
  if (!deletedAt) {
    return false;
  }
  const deletedMs = Date.parse(deletedAt);
  return !Number.isNaN(deletedMs) && nowMs - deletedMs >= retentionDays * DAY_MS;
}

/** Permanently removes one document's files then its row (best-effort files). */
async function purgeOne(doc: DocumentEntity, deps: TrashDeps): Promise<void> {
  await deps.deleteFile(doc.filePath).catch(() => undefined);
  if (doc.thumbnailPath) {
    await deps.deleteFile(doc.thumbnailPath).catch(() => undefined);
  }
  await deps.hardDelete(doc.id);
}

/**
 * Permanently deletes a single trashed document (the "Delete forever" action).
 * Returns true when the row was removed.
 */
export async function deleteForever(doc: DocumentEntity, deps: TrashDeps): Promise<boolean> {
  await purgeOne(doc, deps);
  logger.info({ event: 'vault.trash.delete_forever', documentId: doc.id });
  return true;
}

/**
 * Purges every document whose retention window has elapsed. Meant to run at
 * app start and when the Trash is opened. Best-effort per document so one
 * failure can't block the rest; returns how many were purged.
 */
export async function purgeExpiredTrash(
  deps: TrashDeps,
  retentionDays = TRASH_RETENTION_DAYS
): Promise<{ purged: number }> {
  const trashed = await deps.listTrashed();
  const nowMs = deps.now();
  let purged = 0;
  for (const doc of trashed) {
    if (!isExpired(doc.deletedAt, nowMs, retentionDays)) {
      continue;
    }
    try {
      await purgeOne(doc, deps);
      purged += 1;
    } catch (err) {
      logger.warn({
        event: 'vault.trash.purge_error',
        documentId: doc.id,
        err: { message: String(err) },
      });
    }
  }
  if (purged > 0) {
    logger.info({ event: 'vault.trash.purge', purged, retentionDays });
  }
  return { purged };
}

/** Permanently deletes the entire Trash (the "Empty trash" action). */
export async function emptyTrash(deps: TrashDeps): Promise<{ purged: number }> {
  const trashed = await deps.listTrashed();
  let purged = 0;
  for (const doc of trashed) {
    try {
      await purgeOne(doc, deps);
      purged += 1;
    } catch (err) {
      logger.warn({
        event: 'vault.trash.empty_error',
        documentId: doc.id,
        err: { message: String(err) },
      });
    }
  }
  logger.info({ event: 'vault.trash.empty', purged });
  return { purged };
}
