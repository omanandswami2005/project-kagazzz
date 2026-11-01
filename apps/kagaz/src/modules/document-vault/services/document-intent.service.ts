/**
 * OS-level document intents (F-64 Open with / F-65 Share): hand a stored vault
 * document to another app via the platform's own choosers —
 *   - **Open with** → Android `ACTION_VIEW` chooser (all apps that can *view*
 *     the type), via `@capacitor-community/file-opener` (`openWithDefault:false`);
 *   - **Share**     → Android `ACTION_SEND` share sheet, via `@capacitor/share`.
 *
 * Both are user-initiated and native-only (no-op on web). The file leaves the
 * app's control at the user's explicit choice — no data is sent anywhere by the
 * app itself; the OS chooser is the user's decision. [SEC] the URI is a
 * FileProvider `content://` handle the plugins mint; raw paths never leak.
 *
 * Dependencies are injected so the orchestration is unit-testable without native.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { mimeTypeFor } from './upload.service';

/** True when native intents are available (Android/iOS, not web). */
export function isIntentSupported(): boolean {
  return Capacitor.getPlatform() !== 'web';
}

/** Injectable surface (tests pass fakes; runtime uses the plugins). */
export interface DocumentIntentDeps {
  getUri: (path: string) => Promise<string>;
  share: (options: {
    title: string;
    url?: string;
    files?: string[];
    dialogTitle?: string;
  }) => Promise<unknown>;
  openFile: (options: {
    filePath: string;
    contentType?: string;
    openWithDefault?: boolean;
  }) => Promise<void>;
}

/** Default deps wired to the Capacitor plugins. */
export const defaultIntentDeps: DocumentIntentDeps = {
  getUri: async (path) =>
    (await Filesystem.getUri({ directory: Directory.Data, path })).uri,
  share: (options) => Share.share(options),
  openFile: (options) => FileOpener.open(options),
};

/** Shares a document through the OS share sheet (F-65). */
export async function shareDocument(
  document: DocumentEntity,
  deps: DocumentIntentDeps = defaultIntentDeps
): Promise<void> {
  const url = await deps.getUri(document.filePath);
  await deps.share({ title: document.name, url });
}

/**
 * Shares multiple documents in one OS share sheet (F-65 bulk-select
 * follow-up) — `@capacitor/share`'s `files` array (v4.1+) is exactly this:
 * multiple `file://` URIs in one `ACTION_SEND_MULTIPLE` intent, each still
 * resolved through the receiving plugin's own FileProvider. A single
 * document delegates to {@link shareDocument} (plain `url`, the simpler and
 * more broadly compatible single-file shape).
 */
export async function shareDocuments(
  documents: DocumentEntity[],
  deps: DocumentIntentDeps = defaultIntentDeps
): Promise<void> {
  if (documents.length === 0) {
    return;
  }
  if (documents.length === 1) {
    await shareDocument(documents[0], deps);
    return;
  }
  const files = await Promise.all(documents.map((d) => deps.getUri(d.filePath)));
  await deps.share({
    title: documents.map((d) => d.name).join(', '),
    files,
  });
}

/** Opens a document in another app via the "Open with" chooser (F-64). */
export async function openDocumentWith(
  document: DocumentEntity,
  deps: DocumentIntentDeps = defaultIntentDeps
): Promise<void> {
  const filePath = await deps.getUri(document.filePath);
  await deps.openFile({
    filePath,
    contentType: mimeTypeFor(document.fileType),
    // false → present the "Open with" app chooser rather than a default app.
    openWithDefault: false,
  });
}
