import { beforeEach, describe, expect, it, vi } from 'vitest';

const scanner = vi.hoisted(() => ({ scanDocument: vi.fn() }));
const platform = vi.hoisted((): { value: string } => ({ value: 'android' }));

vi.mock('@capacitor-mlkit/document-scanner', () => ({ DocumentScanner: scanner }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform.value } }));

import { isScanningSupported, scanDocument } from '../scanner.service';

beforeEach(() => {
  vi.clearAllMocks();
  platform.value = 'android';
});

describe('isScanningSupported', () => {
  it('is true on Android, false elsewhere', () => {
    expect(isScanningSupported()).toBe(true);
    platform.value = 'ios';
    expect(isScanningSupported()).toBe(false);
    platform.value = 'web';
    expect(isScanningSupported()).toBe(false);
  });
});

describe('scanDocument (F-2 / ADR-018)', () => {
  it('returns the scanned pages + combined PDF, with the right options', async () => {
    scanner.scanDocument.mockResolvedValue({
      scannedImages: ['file:///a.jpg', 'file:///b.jpg'],
      pdf: { uri: 'file:///scan.pdf', pageCount: 2 },
    });
    const result = await scanDocument();
    expect(result).toEqual({
      imageUris: ['file:///a.jpg', 'file:///b.jpg'],
      pdfUri: 'file:///scan.pdf',
      pageCount: 2,
    });
    expect(scanner.scanDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        resultFormats: 'JPEG_PDF',
        scannerMode: 'FULL',
        galleryImportAllowed: false,
      })
    );
  });

  it('falls back to the image count when no PDF is returned', async () => {
    scanner.scanDocument.mockResolvedValue({ scannedImages: ['file:///a.jpg'] });
    expect((await scanDocument())?.pageCount).toBe(1);
  });

  it('returns null on an unsupported platform without calling the plugin', async () => {
    platform.value = 'ios';
    expect(await scanDocument()).toBeNull();
    expect(scanner.scanDocument).not.toHaveBeenCalled();
  });

  it('returns null when the user cancels', async () => {
    scanner.scanDocument.mockRejectedValue(new Error('The scan was cancelled'));
    expect(await scanDocument()).toBeNull();
  });

  it('returns null when nothing was captured', async () => {
    scanner.scanDocument.mockResolvedValue({ scannedImages: [] });
    expect(await scanDocument()).toBeNull();
  });

  it('rethrows a genuine failure', async () => {
    scanner.scanDocument.mockRejectedValue(new Error('play services unavailable'));
    await expect(scanDocument()).rejects.toThrow('play services');
  });
});
