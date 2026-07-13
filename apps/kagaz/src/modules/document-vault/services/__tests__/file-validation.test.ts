import { describe, expect, it } from 'vitest';
import {
  FileType,
  MAX_FILE_SIZE_BYTES,
  VaultErrorCode,
} from '../../types/document.types';
import {
  fileTypeFromName,
  hasSufficientSpace,
  matchesMagicBytes,
  sanitizeName,
  splitFileName,
  validateFile,
} from '../file-validation';
import {
  heicBytes,
  jpgBytes,
  pdfBytes,
  pngBytes,
  webpBytes,
} from '../../__tests__/fixtures/vault-fixtures';

function blobOf(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer]);
}

describe('sanitizeName', () => {
  it('replaces path separators with underscores', () => {
    expect(sanitizeName('a/b\\c')).toBe('a_b_c');
  });

  it('strips control characters and trims', () => {
    expect(
      sanitizeName(`  he${String.fromCharCode(0)}llo${String.fromCharCode(127)}  `)
    ).toBe('hello');
  });

  it('caps the length at 255 characters', () => {
    expect(sanitizeName('x'.repeat(300))).toHaveLength(255);
  });
});

describe('splitFileName / fileTypeFromName', () => {
  it('splits base and lowercased extension', () => {
    expect(splitFileName('Scan.PDF')).toEqual({
      base: 'Scan',
      extension: 'pdf',
    });
  });

  it('handles names without an extension', () => {
    expect(splitFileName('README')).toEqual({
      base: 'README',
      extension: '',
    });
    expect(fileTypeFromName('README')).toBeNull();
  });

  it('maps heif to the HEIC file type', () => {
    expect(fileTypeFromName('photo.heif')).toBe(FileType.HEIC);
  });
});

describe('matchesMagicBytes', () => {
  it.each([
    [FileType.PDF, pdfBytes()],
    [FileType.JPG, jpgBytes()],
    [FileType.JPEG, jpgBytes()],
    [FileType.PNG, pngBytes()],
    [FileType.WEBP, webpBytes()],
    [FileType.HEIC, heicBytes()],
  ])('accepts a valid %s header', (type, bytes) => {
    expect(matchesMagicBytes(type, bytes)).toBe(true);
  });

  it('rejects a mismatched header', () => {
    expect(matchesMagicBytes(FileType.PDF, pngBytes())).toBe(false);
    expect(matchesMagicBytes(FileType.PNG, pdfBytes())).toBe(false);
    expect(matchesMagicBytes(FileType.WEBP, pdfBytes())).toBe(false);
    expect(matchesMagicBytes(FileType.HEIC, pdfBytes())).toBe(false);
  });

  it('rejects unsupported types', () => {
    expect(matchesMagicBytes(FileType.DOCX, pdfBytes())).toBe(false);
  });
});

describe('validateFile', () => {
  it('accepts a well-formed PDF', async () => {
    await expect(validateFile('tax.pdf', blobOf(pdfBytes()))).resolves.toEqual(
      { valid: true, fileType: FileType.PDF }
    );
  });

  it('rejects an empty sanitized name', async () => {
    await expect(
      validateFile(`${String.fromCharCode(0, 1)}.pdf`, blobOf(pdfBytes()))
    ).resolves.toEqual({
      valid: false,
      code: VaultErrorCode.INVALID_FILE_NAME,
    });
  });

  it('rejects unsupported extensions', async () => {
    await expect(
      validateFile('virus.exe', blobOf(pdfBytes()))
    ).resolves.toEqual({
      valid: false,
      code: VaultErrorCode.INVALID_FILE_TYPE,
    });
  });

  it('accepts a text file (F-40, no magic bytes)', async () => {
    await expect(
      validateFile('notes.txt', new Blob(['hello world']))
    ).resolves.toEqual({ valid: true, fileType: FileType.TXT });
  });

  it('accepts a Markdown file (F-40)', async () => {
    await expect(
      validateFile('readme.md', new Blob(['# Title']))
    ).resolves.toEqual({ valid: true, fileType: FileType.MD });
  });

  it('rejects files over the size ceiling', async () => {
    const big = {
      size: MAX_FILE_SIZE_BYTES + 1,
      slice: (): Blob => blobOf(pdfBytes()),
    } as unknown as Blob;
    await expect(validateFile('big.pdf', big)).resolves.toEqual({
      valid: false,
      code: VaultErrorCode.FILE_TOO_LARGE,
    });
  });

  it('rejects empty files as corrupted', async () => {
    await expect(validateFile('empty.pdf', new Blob([]))).resolves.toEqual({
      valid: false,
      code: VaultErrorCode.CORRUPTED_FILE,
    });
  });

  it('rejects files whose header contradicts the extension', async () => {
    await expect(
      validateFile('fake.pdf', blobOf(pngBytes()))
    ).resolves.toEqual({
      valid: false,
      code: VaultErrorCode.CORRUPTED_FILE,
    });
  });
});

describe('hasSufficientSpace', () => {
  it('passes when the estimate leaves enough headroom', async () => {
    await expect(
      hasSufficientSpace(100, () =>
        Promise.resolve({ quota: 10_000, usage: 0 })
      )
    ).resolves.toBe(true);
  });

  it('fails when free space is below size × 1.5', async () => {
    await expect(
      hasSufficientSpace(100, () =>
        Promise.resolve({ quota: 1000, usage: 900 })
      )
    ).resolves.toBe(false);
  });

  it('passes open-loop when the platform has no estimate', async () => {
    await expect(
      hasSufficientSpace(100, () => Promise.resolve({}))
    ).resolves.toBe(true);
  });

  it('passes open-loop when the estimate itself throws', async () => {
    await expect(
      hasSufficientSpace(100, () => Promise.reject(new Error('nope')))
    ).resolves.toBe(true);
  });

  it('uses the navigator default without crashing', async () => {
    await expect(hasSufficientSpace(100)).resolves.toBeTypeOf('boolean');
  });
});
