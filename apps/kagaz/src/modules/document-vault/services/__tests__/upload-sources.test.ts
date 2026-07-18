import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera } from '@capacitor/camera';
import { scanDocument } from '@/modules/document-scanner/services/scanner.service';
import {
  pickFiles,
  pickFromCamera,
  pickFromFiles,
  pickFromGallery,
  pickFromScanner,
} from '../upload-sources';

vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: vi.fn(), pickImages: vi.fn() },
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Camera: 'CAMERA' },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', convertFileSrc: (u: string) => u },
}));
vi.mock('@/modules/document-scanner/services/scanner.service', () => ({
  scanDocument: vi.fn(),
  isScanningSupported: () => true,
}));

const getPhoto = vi.mocked(Camera.getPhoto);
const pickImages = vi.mocked(Camera.pickImages);
const mockScan = vi.mocked(scanDocument);

const photoBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])]);

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ blob: () => Promise.resolve(photoBlob) }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pickFromCamera', () => {
  it('returns the captured photo as an IncomingFile', async () => {
    getPhoto.mockResolvedValue({
      webPath: 'blob:photo-1',
      format: 'jpeg',
      saved: false,
    });
    const files = await pickFromCamera();
    expect(files).toHaveLength(1);
    expect(files[0]?.source).toBe('camera');
    expect(files[0]?.name).toMatch(/^Camera_.+\.jpeg$/);
    expect(files[0]?.blob).toBe(photoBlob);
  });

  it('returns [] when the user cancels', async () => {
    getPhoto.mockRejectedValue(new Error('User cancelled photos app'));
    await expect(pickFromCamera()).resolves.toEqual([]);
  });

  it('returns [] when the photo has no webPath', async () => {
    getPhoto.mockResolvedValue({ format: 'jpeg', saved: false });
    await expect(pickFromCamera()).resolves.toEqual([]);
  });

  it('rethrows real camera failures', async () => {
    getPhoto.mockRejectedValue(new Error('Camera unavailable'));
    await expect(pickFromCamera()).rejects.toThrow('Camera unavailable');
  });
});

describe('pickFromGallery', () => {
  it('returns every picked image', async () => {
    pickImages.mockResolvedValue({
      photos: [
        { webPath: 'blob:1', format: 'png' },
        { webPath: 'blob:2', format: 'jpeg' },
      ],
    });
    const files = await pickFromGallery();
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.source === 'gallery')).toBe(true);
  });

  it('skips photos without webPath and handles cancellation', async () => {
    pickImages.mockResolvedValue({
      photos: [{ format: 'png' } as never],
    });
    await expect(pickFromGallery()).resolves.toEqual([]);

    pickImages.mockRejectedValue(new Error('pickImages cancelled'));
    await expect(pickFromGallery()).resolves.toEqual([]);
  });

  it('rethrows real gallery failures', async () => {
    pickImages.mockRejectedValue(new Error('permission denied'));
    await expect(pickFromGallery()).rejects.toThrow('permission denied');
  });
});

describe('pickFromFiles', () => {
  it('resolves the chosen files from the transient input', async () => {
    const promise = pickFromFiles(document);
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]'
    );
    expect(input).not.toBeNull();
    expect(input?.accept).toContain('.pdf');

    const file = new File([new Uint8Array([0x25])], 'doc.pdf');
    Object.defineProperty(input, 'files', { value: [file] });
    input?.dispatchEvent(new Event('change'));

    const files = await promise;
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe('doc.pdf');
    expect(files[0]?.source).toBe('file_picker');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('resolves [] when the picker is cancelled', async () => {
    const promise = pickFromFiles(document);
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]'
    );
    input?.dispatchEvent(new Event('cancel'));
    await expect(promise).resolves.toEqual([]);
  });
});

describe('pickFromScanner (F-2 / ADR-018)', () => {
  it('imports a multi-page scan as a single combined PDF', async () => {
    mockScan.mockResolvedValue({
      imageUris: ['file:///a.jpg', 'file:///b.jpg'],
      pdfUri: 'file:///scan.pdf',
      pageCount: 2,
    });
    const files = await pickFromScanner();
    expect(files).toHaveLength(1);
    expect(files[0]?.source).toBe('scanner');
    expect(files[0]?.name).toMatch(/^Scan_.+\.pdf$/);
  });

  it('imports a single-page scan as a JPEG', async () => {
    mockScan.mockResolvedValue({
      imageUris: ['file:///a.jpg'],
      pageCount: 1,
    });
    const files = await pickFromScanner();
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toMatch(/^Scan_.+\.jpg$/);
    expect(files[0]?.source).toBe('scanner');
  });

  it('returns [] when the scan is cancelled', async () => {
    mockScan.mockResolvedValue(null);
    await expect(pickFromScanner()).resolves.toEqual([]);
  });
});

describe('pickFiles', () => {
  it('dispatches to the right picker per source', async () => {
    getPhoto.mockRejectedValue(new Error('cancelled'));
    pickImages.mockRejectedValue(new Error('cancelled'));
    await expect(pickFiles('camera')).resolves.toEqual([]);
    await expect(pickFiles('gallery')).resolves.toEqual([]);

    const promise = pickFiles('files');
    document
      .querySelector<HTMLInputElement>('input[type="file"]')
      ?.dispatchEvent(new Event('cancel'));
    await expect(promise).resolves.toEqual([]);
  });
});
