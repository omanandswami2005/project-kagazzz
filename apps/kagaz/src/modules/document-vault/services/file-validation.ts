/**
 * Upload file validation (02-document-vault-module.md §File Validation
 * Rules): type allow-list, size ceiling, name sanitization, magic-byte
 * corruption check, and free-space guard.
 */
import {
  FREE_SPACE_FACTOR,
  FileType,
  MAX_FILE_SIZE_BYTES,
  MAX_NAME_LENGTH,
  UPLOADABLE_FILE_TYPES,
  VaultErrorCode,
  type ValidationResult,
} from '../types/document.types';

/** Lowercased extension → FileType for the F-1 upload allow-list. */
const EXTENSION_TO_TYPE: Record<string, FileType> = {
  pdf: FileType.PDF,
  jpg: FileType.JPG,
  jpeg: FileType.JPEG,
  png: FileType.PNG,
  heic: FileType.HEIC,
  heif: FileType.HEIC,
  webp: FileType.WEBP,
};

/** MIME types the pickers advertise, mapped to a FileType. */
export const UPLOAD_ACCEPT_MIME: Record<string, FileType> = {
  'application/pdf': FileType.PDF,
  'image/jpeg': FileType.JPG,
  'image/png': FileType.PNG,
  'image/heic': FileType.HEIC,
  'image/heif': FileType.HEIC,
  'image/webp': FileType.WEBP,
};

/** `accept` attribute value for the file-picker input. */
export const UPLOAD_ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.heic,.heif,.webp';

/** MIME type stored for each uploadable FileType. */
export const TYPE_TO_MIME: Record<string, string> = {
  [FileType.PDF]: 'application/pdf',
  [FileType.JPG]: 'image/jpeg',
  [FileType.JPEG]: 'image/jpeg',
  [FileType.PNG]: 'image/png',
  [FileType.HEIC]: 'image/heic',
  [FileType.WEBP]: 'image/webp',
};

/**
 * Strips path separators and control characters, trims, and caps length
 * (spec §Validation Rules: 1–255 chars, no `/` or `\`).
 */
export function sanitizeName(raw: string): string {
  return [...raw.replace(/[/\\]/g, '_')]
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/** Splits `name.ext` → display name + lowercased extension. */
export function splitFileName(fileName: string): {
  base: string;
  extension: string;
} {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return { base: fileName, extension: '' };
  }
  return {
    base: fileName.slice(0, dot),
    extension: fileName.slice(dot + 1).toLowerCase(),
  };
}

/** Resolves the FileType from a file name's extension, if uploadable. */
export function fileTypeFromName(fileName: string): FileType | null {
  const { extension } = splitFileName(fileName);
  return EXTENSION_TO_TYPE[extension] ?? null;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** HEIF brand strings that identify a HEIC/HEIF container. */
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'];

/**
 * Magic-byte sniffing per type (spec §File Validation Rules: corruption
 * check). Returns true when the header matches the claimed type.
 */
export function matchesMagicBytes(type: FileType, header: Uint8Array): boolean {
  switch (type) {
    case FileType.PDF:
      return ascii(header, 0, 4) === '%PDF';
    case FileType.JPG:
    case FileType.JPEG:
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case FileType.PNG:
      return (
        header[0] === 0x89 &&
        ascii(header, 1, 4) === 'PNG' &&
        header[4] === 0x0d &&
        header[5] === 0x0a
      );
    case FileType.WEBP:
      return ascii(header, 0, 4) === 'RIFF' && ascii(header, 8, 12) === 'WEBP';
    case FileType.HEIC:
      return (
        ascii(header, 4, 8) === 'ftyp' &&
        HEIC_BRANDS.includes(ascii(header, 8, 12))
      );
    default:
      return false;
  }
}

/**
 * Validates one incoming file: name, extension allow-list, size, and
 * header magic bytes. Pure I/O-light check — free space is a separate
 * guard because it depends on the whole batch.
 */
export async function validateFile(
  name: string,
  blob: Blob
): Promise<ValidationResult> {
  if (sanitizeName(splitFileName(name).base).length === 0) {
    return { valid: false, code: VaultErrorCode.INVALID_FILE_NAME };
  }

  const fileType = fileTypeFromName(name);
  if (!fileType || !UPLOADABLE_FILE_TYPES.includes(fileType)) {
    return { valid: false, code: VaultErrorCode.INVALID_FILE_TYPE };
  }

  if (blob.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, code: VaultErrorCode.FILE_TOO_LARGE };
  }
  if (blob.size === 0) {
    return { valid: false, code: VaultErrorCode.CORRUPTED_FILE };
  }

  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (!matchesMagicBytes(fileType, header)) {
    return { valid: false, code: VaultErrorCode.CORRUPTED_FILE };
  }

  return { valid: true, fileType };
}

/**
 * Free-space guard (spec: available > size × 1.5). Uses the
 * StorageManager estimate when the platform provides one; passes
 * open-loop when it does not (native quota is far larger than any
 * single document).
 */
export async function hasSufficientSpace(
  requiredBytes: number,
  estimate: () => Promise<{ quota?: number; usage?: number }> = () =>
    typeof navigator !== 'undefined' && navigator.storage?.estimate
      ? navigator.storage.estimate()
      : Promise.resolve({})
): Promise<boolean> {
  try {
    const { quota, usage } = await estimate();
    if (quota === undefined || usage === undefined) {
      return true;
    }
    return quota - usage > requiredBytes * FREE_SPACE_FACTOR;
  } catch {
    return true;
  }
}
