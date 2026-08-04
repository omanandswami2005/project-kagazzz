/**
 * F-108 Receive Share (inbound counterpart to F-64/F-65's outbound document
 * intents, `document-intent.service.ts`): wraps the custom native
 * `ShareReceiver` plugin (`ShareReceiverPlugin.java`) that resolves an
 * incoming Android `ACTION_SEND`/`ACTION_SEND_MULTIPLE` intent — this is
 * what makes Kagaz show up in the OS share sheet from any other app
 * (Gallery, WhatsApp, a file manager…) and lets a shared file/image be
 * imported into the vault.
 *
 * Text-only shares (a shared link/message with no file attached) are
 * intentionally ignored — this is a document-import surface, not a
 * general-purpose text-capture one.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { log } from '@/core/logging';
import type { IncomingFile } from '../types/document.types';
import { TYPE_TO_MIME } from './file-validation';

const logger = log('document-vault');

/** One shared item's native-resolved metadata. */
export interface SharedItem {
  /** content:// (or file://) URI, readable via Capacitor.convertFileSrc. */
  uri: string;
  mimeType: string | null;
  /** Best-effort original filename from the sending app's provider. */
  name: string | null;
}

/** What ShareReceiverPlugin.java hands back — items and/or a text-only payload. */
export interface PendingShare {
  items: SharedItem[];
  text: string | null;
}

const EMPTY_SHARE: PendingShare = { items: [], text: null };

interface ShareReceiverPluginApi {
  getPendingShare(): Promise<PendingShare>;
  addListener(
    eventName: 'shareReceived',
    listener: (share: PendingShare) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const ShareReceiver = registerPlugin<ShareReceiverPluginApi>('ShareReceiver', {
  web: () => ({
    getPendingShare: (): Promise<PendingShare> => Promise.resolve(EMPTY_SHARE),
    addListener: (): Promise<{ remove: () => Promise<void> }> =>
      Promise.resolve({ remove: () => Promise.resolve() }),
  }),
});

/** True when the native share-receiving plugin is available (Android only — no iOS share extension yet). */
export function isShareReceiveSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** Reads whatever share was pending when the app launched/foregrounded (cold start). */
export function getPendingShare(): Promise<PendingShare> {
  return ShareReceiver.getPendingShare();
}

/** Subscribes to a share arriving while the app is already running (warm start). */
export function onShareReceived(
  callback: (share: PendingShare) => void
): Promise<{ remove: () => Promise<void> }> {
  return ShareReceiver.addListener('shareReceived', callback);
}

/** Reverse of TYPE_TO_MIME — last-write-wins for MIME types shared by two extensions (jpg/jpeg). */
const EXTENSION_FROM_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_MIME).map(([type, mime]) => [mime, type])
);

/** Timestamped fallback name when the sending app provided no display name. */
function fallbackName(mimeType: string | null): string {
  const ext = (mimeType && EXTENSION_FROM_MIME[mimeType]) || 'bin';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `Shared_${stamp}.${ext}`;
}

/** Appends an extension from the MIME type when the provider's display name omitted one. */
function ensureExtension(name: string, mimeType: string | null): string {
  if (/\.[a-z0-9]{1,5}$/i.test(name)) {
    return name;
  }
  const ext = mimeType && EXTENSION_FROM_MIME[mimeType];
  return ext ? `${name}.${ext}` : name;
}

/**
 * Reads a shared item's bytes and turns it into an {@link IncomingFile} for
 * `useUpload().ingestFiles()` — the same pipeline every other upload source
 * (camera/gallery/files/scanner) already goes through (validated, hashed,
 * stored, thumbnailed; invalid/oversized/corrupt files are rejected there,
 * not here). The URI belongs to the *sending* app's own FileProvider;
 * `Capacitor.convertFileSrc` resolves a `content://` URI through the
 * WebView's content-resolver bridge — no separate native copy step needed.
 * Returns null (rather than throwing) on a read failure so one bad item in
 * a multi-share doesn't abort the rest.
 */
export async function sharedItemToIncomingFile(item: SharedItem): Promise<IncomingFile | null> {
  try {
    const blob = await (await fetch(Capacitor.convertFileSrc(item.uri))).blob();
    const name = ensureExtension(item.name ?? fallbackName(item.mimeType), item.mimeType);
    return { name, blob, source: 'file_picker' };
  } catch (error) {
    logger.warn({ event: 'vault.share_receive.read_error', err: { message: String(error) } });
    return null;
  }
}

/** Converts every item with an actual file stream; a text-only share yields an empty array. */
export async function pendingShareToIncomingFiles(share: PendingShare): Promise<IncomingFile[]> {
  const files = await Promise.all(share.items.map(sharedItemToIncomingFile));
  return files.filter((file): file is IncomingFile => file !== null);
}
