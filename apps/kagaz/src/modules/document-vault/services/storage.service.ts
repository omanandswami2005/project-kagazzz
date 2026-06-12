/**
 * Storage statistics (02-document-vault-module.md §Storage Management).
 * Assembles the vault's usage breakdown from DocumentDao aggregates for
 * the Storage page (F-26). Pure shaping — all I/O is in the DAO.
 */
import type { DocumentEntity } from '@/infrastructure/database/types';

/** A storage slice for one file type. */
export interface TypeUsage {
  fileType: string;
  bytes: number;
  count: number;
  /** Share of total bytes, 0–1. */
  fraction: number;
}

/** The full storage snapshot shown on the Storage page. */
export interface StorageStats {
  totalBytes: number;
  documentCount: number;
  byType: TypeUsage[];
  largest: DocumentEntity[];
  duplicateGroups: number;
  reclaimableBytes: number;
}

/** Inputs gathered from the DAO. */
export interface StorageInputs {
  totals: { totalBytes: number; count: number };
  usageByType: { fileType: string; bytes: number; count: number }[];
  largest: DocumentEntity[];
  duplicates: { groups: number; wastedBytes: number };
}

/** Shapes raw DAO aggregates into a {@link StorageStats}. */
export function buildStorageStats(input: StorageInputs): StorageStats {
  const total = input.totals.totalBytes;
  return {
    totalBytes: total,
    documentCount: input.totals.count,
    byType: input.usageByType.map((u) => ({
      ...u,
      fraction: total > 0 ? u.bytes / total : 0,
    })),
    largest: input.largest,
    duplicateGroups: input.duplicates.groups,
    reclaimableBytes: input.duplicates.wastedBytes,
  };
}
