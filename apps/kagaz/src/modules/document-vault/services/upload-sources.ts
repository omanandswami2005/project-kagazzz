/**
 * Upload input sources (02-document-vault-module.md §Input Sources):
 * camera and gallery via @capacitor/camera (its web implementation
 * falls back to file inputs), and a DOM file input for arbitrary
 * supported documents. Each picker resolves to IncomingFile[] — an
 * empty array means the user cancelled.
 */
import {
  Camera,
  CameraResultType,
  CameraSource,
  type GalleryPhoto,
  type Photo,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { log } from '@/core/logging';
import { scanDocument } from '@/modules/document-scanner/services/scanner.service';
import type { IncomingFile } from '../types/document.types';
import { UPLOAD_ACCEPT_ATTR } from './file-validation';

const logger = log('document-vault');

/** Upload input sources: F-1's camera/gallery/files + F-2's native scanner. */
export type UploadSource = 'camera' | 'gallery' | 'files' | 'scanner';

/** Capacitor plugins throw on user cancellation — detect, don't fail. */
function isCancellation(error: unknown): boolean {
  return /cancel/i.test(error instanceof Error ? error.message : String(error));
}

/** Timestamped name for captures that have no original file name. */
function captureName(prefix: string, format: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${stamp}.${format}`;
}

async function photoToIncomingFile(
  photo: Photo | GalleryPhoto,
  source: 'camera' | 'gallery'
): Promise<IncomingFile | null> {
  if (!photo.webPath) {
    return null;
  }
  // webPath is a local blob:/capacitor URL — no network involved.
  const blob = await (await fetch(photo.webPath)).blob();
  return {
    name: captureName(source === 'camera' ? 'Camera' : 'Photo', photo.format),
    blob,
    source,
  };
}

/** Captures one photo with the device camera. */
export async function pickFromCamera(): Promise<IncomingFile[]> {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 90,
    });
    const file = await photoToIncomingFile(photo, 'camera');
    return file ? [file] : [];
  } catch (error) {
    if (isCancellation(error)) {
      return [];
    }
    throw error;
  }
}

/** Picks one or more images from the device gallery. */
export async function pickFromGallery(): Promise<IncomingFile[]> {
  try {
    const { photos } = await Camera.pickImages({ quality: 90 });
    const files = await Promise.all(
      photos.map((photo) => photoToIncomingFile(photo, 'gallery'))
    );
    return files.filter((file): file is IncomingFile => file !== null);
  } catch (error) {
    if (isCancellation(error)) {
      return [];
    }
    throw error;
  }
}

/**
 * Opens the platform file picker via a transient `<input type="file">`
 * (works in the Capacitor webview and on the web; no extra plugin).
 */
export function pickFromFiles(
  doc: Document = document
): Promise<IncomingFile[]> {
  return new Promise((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = UPLOAD_ACCEPT_ATTR;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])].map((file) => ({
        name: file.name,
        blob: file,
        source: 'file_picker' as const,
      }));
      input.remove();
      resolve(files);
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve([]);
    });
    doc.body.appendChild(input);
    input.click();
  });
}

/** Reads a device file URI into a Blob via the Capacitor file bridge. */
async function uriToBlob(uri: string): Promise<Blob | null> {
  try {
    // convertFileSrc yields a capacitor://localhost URL the WebView can fetch —
    // still local, no network.
    return await (await fetch(Capacitor.convertFileSrc(uri))).blob();
  } catch (error) {
    logger.warn({ event: 'vault.scan.read_error', err: { message: String(error) } });
    return null;
  }
}

/**
 * Runs the native ML Kit scan (F-2, ADR-018) and returns its pages as
 * IncomingFiles. A multi-page scan imports as a single combined PDF; a single
 * page imports as a JPEG. Empty array = cancelled / nothing scanned.
 */
export async function pickFromScanner(): Promise<IncomingFile[]> {
  const scan = await scanDocument();
  if (!scan) {
    return [];
  }
  if (scan.pageCount > 1 && scan.pdfUri) {
    const blob = await uriToBlob(scan.pdfUri);
    return blob ? [{ name: captureName('Scan', 'pdf'), blob, source: 'scanner' }] : [];
  }
  const files = await Promise.all(
    scan.imageUris.map(async (uri): Promise<IncomingFile | null> => {
      const blob = await uriToBlob(uri);
      return blob ? { name: captureName('Scan', 'jpg'), blob, source: 'scanner' } : null;
    })
  );
  return files.filter((file): file is IncomingFile => file !== null);
}

/** Dispatches to the picker for a source. */
export async function pickFiles(source: UploadSource): Promise<IncomingFile[]> {
  logger.debug({ event: 'vault.upload.pick', source });
  switch (source) {
    case 'camera':
      return pickFromCamera();
    case 'gallery':
      return pickFromGallery();
    case 'files':
      return pickFromFiles();
    case 'scanner':
      return pickFromScanner();
  }
}
