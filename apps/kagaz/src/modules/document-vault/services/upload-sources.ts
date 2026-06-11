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
import { log } from '@/core/logging';
import type { IncomingFile } from '../types/document.types';
import { UPLOAD_ACCEPT_ATTR } from './file-validation';

const logger = log('document-vault');

/** The three F-1 upload sources (scanner arrives with F-2). */
export type UploadSource = 'camera' | 'gallery' | 'files';

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
  }
}
