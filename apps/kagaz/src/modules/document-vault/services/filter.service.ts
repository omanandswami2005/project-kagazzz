/**
 * Document filters (02-document-vault-module.md §Filter System). Combined
 * with AND logic and applied client-side over the loaded list (same model
 * as sort.service), so toggling a filter is instant (F-12).
 */
import type {
  DocumentEntity,
  TagEntity,
} from '@/infrastructure/database/types';
import { FileType } from '../types/document.types';

/** Coarse type buckets the filter UI offers (spec §Available Filters). */
export type FileKind = 'pdf' | 'image' | 'other';

/** Size buckets in bytes (spec §Available Filters). */
export type SizeBucket = 'lt1mb' | '1to5mb' | '5to25mb' | 'gt25mb';

/** The active filter selection; empty/undefined fields don't constrain. */
export interface DocumentFilters {
  kinds: FileKind[];
  sizes: SizeBucket[];
  tagIds: string[];
  favoritesOnly: boolean;
}

/** The no-op filter (everything passes). */
export const EMPTY_FILTERS: DocumentFilters = {
  kinds: [],
  sizes: [],
  tagIds: [],
  favoritesOnly: false,
};

const IMAGE_TYPES: readonly string[] = [
  FileType.JPG,
  FileType.JPEG,
  FileType.PNG,
  FileType.HEIC,
  FileType.WEBP,
  FileType.TIFF,
  FileType.BMP,
  FileType.GIF,
];

/** PDF type as a plain string (avoids string-vs-enum comparison). */
const PDF_TYPE: string = FileType.PDF;

/** Maps a stored file type to its coarse bucket. */
export function fileKind(fileType: string): FileKind {
  if (fileType === PDF_TYPE) {
    return 'pdf';
  }
  return IMAGE_TYPES.includes(fileType) ? 'image' : 'other';
}

/** True when a byte size falls in the given bucket. */
export function inSizeBucket(bytes: number, bucket: SizeBucket): boolean {
  const mb = bytes / (1024 * 1024);
  switch (bucket) {
    case 'lt1mb':
      return mb < 1;
    case '1to5mb':
      return mb >= 1 && mb < 5;
    case '5to25mb':
      return mb >= 5 && mb < 25;
    case 'gt25mb':
      return mb >= 25;
  }
}

/** How many dimensions the filter constrains (for the badge count). */
export function activeFilterCount(filters: DocumentFilters): number {
  return (
    filters.kinds.length +
    filters.sizes.length +
    filters.tagIds.length +
    (filters.favoritesOnly ? 1 : 0)
  );
}

/**
 * Returns documents matching every active filter dimension. Dimensions
 * combine with AND; values within a dimension combine with OR.
 */
export function applyFilters(
  documents: DocumentEntity[],
  filters: DocumentFilters,
  tagsByDocument: Map<string, TagEntity[]>
): DocumentEntity[] {
  return documents.filter((doc) => {
    if (filters.favoritesOnly && !doc.isFavorite) {
      return false;
    }
    if (
      filters.kinds.length > 0 &&
      !filters.kinds.includes(fileKind(doc.fileType))
    ) {
      return false;
    }
    if (
      filters.sizes.length > 0 &&
      !filters.sizes.some((bucket) => inSizeBucket(doc.fileSize, bucket))
    ) {
      return false;
    }
    if (filters.tagIds.length > 0) {
      const docTagIds = new Set(
        (tagsByDocument.get(doc.id) ?? []).map((t) => t.id)
      );
      if (!filters.tagIds.some((id) => docTagIds.has(id))) {
        return false;
      }
    }
    return true;
  });
}
