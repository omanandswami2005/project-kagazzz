/**
 * The on-device search model: EmbeddingGemma-300M as a LiteRT-LM `.litertlm`,
 * run by the same native runtime as the chat model (EmbeddingEngine, CPU).
 *
 * It is a SEPARATE, optional download (~330 MB) so chat can be tried without
 * it. Vectors are kept in memory only, so documents are re-embedded after an
 * app restart (MVP; persistence is a follow-up).
 *
 * Provenance: a community conversion of google/embeddinggemma-300m
 * (`kasimtmc/embeddinggemma-litertlm`), not an official Google artifact. The
 * URL is pinned to a commit and the SHA-256 is checked after download, so a
 * later re-upload can never be loaded silently. Licence: Gemma Terms of Use.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { CapacitorLlmLiteRT } from '@kagaz/capacitor-llm-litert';
import { log } from '@/core/logging';

const logger = log('ai-assistant');

export const SEARCH_MODEL_FILENAME = 'embeddinggemma_300m.litertlm';
export const SEARCH_MODEL_URL =
  'https://huggingface.co/kasimtmc/embeddinggemma-litertlm/resolve/9a66a1cfc1357ff2dd36c60965b8fc3908fb438c/embeddinggemma_300m.litertlm';
export const SEARCH_MODEL_SHA256 =
  '1238108bd99cde73b9b7a749e40511fabb4d02258f9e22e2c9d53a1d87441136';
export const SEARCH_MODEL_SIZE_BYTES = 329_822_346;

const PROGRESS_TAG = 'search-model';

/** Android-native only, like the chat model. */
export function isSearchModelSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

let readyPath: string | null = null;

/** Absolute path of the verified model once it is ready; null before. Sync, so backend selection can stay sync. */
export function getReadySearchModelPath(): string | null {
  return readyPath;
}

async function modelPath(): Promise<string> {
  const { uri } = await Filesystem.getUri({
    path: SEARCH_MODEL_FILENAME,
    directory: Directory.Data,
  });
  return uri.replace(/^file:\/\//, '');
}

async function sizeOnDisk(): Promise<number | null> {
  try {
    return (await Filesystem.stat({ path: SEARCH_MODEL_FILENAME, directory: Directory.Data })).size;
  } catch {
    return null;
  }
}

/**
 * Marks the model ready if a complete copy is already on disk (call on app
 * start / settings open). A full-size file is trusted without re-hashing 330 MB
 * every launch; it was hash-verified when it was downloaded.
 */
export async function refreshSearchModelState(): Promise<boolean> {
  if (!isSearchModelSupported()) {
    return false;
  }
  if ((await sizeOnDisk()) === SEARCH_MODEL_SIZE_BYTES) {
    readyPath = await modelPath();
    return true;
  }
  readyPath = null;
  return false;
}

/** Downloads (if needed) and verifies the model, then marks it ready. Throws on failure. */
export async function downloadSearchModel(onProgress: (percent: number) => void): Promise<void> {
  if (!isSearchModelSupported()) {
    throw new Error('The on-device search model needs the Android app.');
  }
  readyPath = null;
  if ((await sizeOnDisk()) !== SEARCH_MODEL_SIZE_BYTES) {
    const subscription = await CapacitorLlmLiteRT.addListener('downloadProgress', (event) => {
      if (event.tag === PROGRESS_TAG) {
        onProgress(event.progress);
      }
    });
    try {
      await CapacitorLlmLiteRT.downloadModel({
        url: SEARCH_MODEL_URL,
        filename: SEARCH_MODEL_FILENAME,
        expectedBytes: SEARCH_MODEL_SIZE_BYTES,
        tag: PROGRESS_TAG,
      });
    } finally {
      await subscription.remove();
    }
  }
  const path = await modelPath();
  const { hash } = await CapacitorLlmLiteRT.sha256File({ path });
  if (hash.toLowerCase() !== SEARCH_MODEL_SHA256) {
    await CapacitorLlmLiteRT.deleteModel({ path }).catch(() => undefined);
    logger.warn({ event: 'search.model.checksum_mismatch' });
    throw new Error('The downloaded search model failed its integrity check.');
  }
  readyPath = path;
  logger.info({ event: 'search.model.verified' });
}

/** Deletes the model and marks search unavailable again. */
export async function deleteSearchModel(): Promise<void> {
  const path = await modelPath();
  readyPath = null;
  await CapacitorLlmLiteRT.deleteModel({ path }).catch(() => undefined);
}
