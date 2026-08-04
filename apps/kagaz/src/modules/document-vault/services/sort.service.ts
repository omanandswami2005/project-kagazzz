/**
 * Document sort (02-document-vault-module.md §Sort Options). Pure,
 * client-side ordering of an already-loaded document list — no DB round
 * trip, so toggling sort is instant.
 */
import type { DocumentEntity } from '@/infrastructure/database/types';

/** Sortable keys (spec §Sort Options). */
export type SortKey =
  | 'name'
  | 'createdAt'
  | 'updatedAt'
  | 'lastAccessedAt'
  | 'fileSize'
  | 'fileType';

/** Sort direction. */
export type SortDirection = 'asc' | 'desc';

/** Default sort key/direction per spec (newest first). */
export const DEFAULT_SORT_KEY: SortKey = 'createdAt';
export const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

/** i18n key (documents namespace) for each sort key's label. */
export const SORT_KEY_LABELS = {
  name: 'sort.name',
  createdAt: 'sort.created',
  updatedAt: 'sort.modified',
  lastAccessedAt: 'sort.accessed',
  fileSize: 'sort.size',
  fileType: 'sort.type',
} as const satisfies Record<SortKey, string>;

/** Sort keys in the order shown in the picker (tuple for z.enum). */
export const SORT_KEYS = [
  'createdAt',
  'updatedAt',
  'lastAccessedAt',
  'name',
  'fileSize',
  'fileType',
] as const satisfies readonly SortKey[];

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareKey(
  a: DocumentEntity,
  b: DocumentEntity,
  key: SortKey,
  direction: SortDirection
): number {
  switch (key) {
    case 'fileSize':
      return a.fileSize - b.fileSize;
    case 'lastAccessedAt': {
      // Bug-audit fix: never-opened documents (no lastAccessedAt) must sort
      // last regardless of direction — a "nulls always last" comparator,
      // not just a plain string compare on `?? ''`. The old `(a ?? '').
      // localeCompare(b ?? '')` put never-opened FIRST in ascending order
      // (empty string sorts before any ISO date), contradicting this
      // file's own doc comment and this test's own title, which the
      // multiply-by-`factor` step below never corrected. Returning a
      // pre-counteracted sign here keeps "last" true in both directions.
      const never = direction === 'asc' ? 1 : -1;
      if (!a.lastAccessedAt && !b.lastAccessedAt) {
        return 0;
      }
      if (!a.lastAccessedAt) {
        return never;
      }
      if (!b.lastAccessedAt) {
        return -never;
      }
      return a.lastAccessedAt.localeCompare(b.lastAccessedAt);
    }
    case 'name':
      return compareText(a.name, b.name);
    case 'fileType':
      return compareText(a.fileType, b.fileType);
    case 'createdAt':
      return a.createdAt.localeCompare(b.createdAt);
    case 'updatedAt':
      return a.updatedAt.localeCompare(b.updatedAt);
  }
}

/**
 * Returns a new array sorted by `key`/`direction`. Stable: ties keep
 * their original relative order (id as the final tiebreaker).
 */
export function sortDocuments(
  documents: DocumentEntity[],
  key: SortKey,
  direction: SortDirection
): DocumentEntity[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...documents].sort((a, b) => {
    const primary = compareKey(a, b, key, direction);
    if (primary !== 0) {
      return primary * factor;
    }
    return a.id.localeCompare(b.id) * factor;
  });
}
