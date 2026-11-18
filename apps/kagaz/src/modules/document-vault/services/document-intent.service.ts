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
 * Outgoing files carry the document's **display name**, not the stored
 * `<uuid>.<ext>` name: the stored file is first copied to
 * `temp/share-<uuid>/<name>.<ext>` and that copy is handed out. temp/ is wiped
 * recursively on every launch ([SEC] 10-security §3.3), so the named copy does
 * not outlive the session; it is not deleted right after the share call because
 * the receiving app may still be reading it.
 *
 * Dependencies are injected so the orchestration is unit-testable without native.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { STORAGE_DIRS } from '@/infrastructure/filesystem';
import { mimeTypeFor } from './upload.service';

/** Characters other apps (Drive, WhatsApp, Windows) reject in file names. */
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/**
 * The file name a document leaves the app with: its display name plus its
 * stored extension, stripped of characters receivers reject, de-duplicated
 * against `taken` with a " (2)" suffix. Mutates `taken`.
 */
export function outgoingFileName(
  document: Pick<DocumentEntity, 'name' | 'fileType'>,
  taken: Set<string> = new Set()
): string {
  const ext = document.fileType.toLowerCase();
  let base = document.name.replace(UNSAFE_FILENAME_CHARS, '_').trim();
  // Guard the double extension ("bill.pdf" named docs → "bill.pdf", not "bill.pdf.pdf").
  if (base.toLowerCase().endsWith(`.${ext}`)) {
    base = base.slice(0, -(ext.length + 1)).trim();
  }
  base ||= 'document';
  let candidate = `${base}.${ext}`;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
    candidate = `${base} (${n}).${ext}`;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** True when native intents are available (Android/iOS, not web). */
export function isIntentSupported(): boolean {
  return Capacitor.getPlatform() !== 'web';
}

/** Injectable surface (tests pass fakes; runtime uses the plugins). */
export interface DocumentIntentDeps {
  getUri: (path: string) => Promise<string>;
  /** Copies a file within app data (creating parent directories). */
  copy: (from: string, to: string) => Promise<void>;
  /** Unique id for the per-call temp folder. */
  newId: () => string;
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
  copy: async (from, to) => {
    // Filesystem.copy does not create the destination's parent on Android.
    await Filesystem.mkdir({
      path: to.slice(0, to.lastIndexOf('/')),
      directory: Directory.Data,
      recursive: true,
    }).catch(() => undefined); // already exists
    await Filesystem.copy({
      from,
      to,
      directory: Directory.Data,
      toDirectory: Directory.Data,
    });
  },
  newId: () => crypto.randomUUID(),
  share: (options) => Share.share(options),
  openFile: (options) => FileOpener.open(options),
};

/**
 * Copies documents into a fresh temp folder under their display names and
 * returns the copies' URIs, in order.
 */
async function namedCopies(
  documents: DocumentEntity[],
  deps: DocumentIntentDeps
): Promise<string[]> {
  const dir = `${STORAGE_DIRS.temp}/share-${deps.newId()}`;
  const taken = new Set<string>();
  return Promise.all(
    documents.map(async (d) => {
      const path = `${dir}/${outgoingFileName(d, taken)}`;
      await deps.copy(d.filePath, path);
      return deps.getUri(path);
    })
  );
}

/** Shares a document through the OS share sheet (F-65). */
export async function shareDocument(
  document: DocumentEntity,
  deps: DocumentIntentDeps = defaultIntentDeps
): Promise<void> {
  const [url] = await namedCopies([document], deps);
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
  const files = await namedCopies(documents, deps);
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
  const [filePath] = await namedCopies([document], deps);
  await deps.openFile({
    filePath,
    contentType: mimeTypeFor(document.fileType),
    // false → present the "Open with" app chooser rather than a default app.
    openWithDefault: false,
  });
}
