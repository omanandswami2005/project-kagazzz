import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
  embedTexts: vi.fn(),
  downloadModel: vi.fn(),
  sha256File: vi.fn(),
  deleteModel: vi.fn(),
  addListener: vi.fn(),
}));
const fs = vi.hoisted(() => ({ stat: vi.fn(), getUri: vi.fn() }));
/** First text sent in the nth native embedTexts call. */
const sentText = (call: number): string =>
  (plugin.embedTexts.mock.calls[call]?.[0] as { texts: string[] }).texts[0] ?? '';
const cap = vi.hoisted(() => ({ native: true }));
const online = vi.hoisted(() => ({ value: false }));

vi.mock('@kagaz/capacitor-llm-litert', () => ({ CapacitorLlmLiteRT: plugin }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fs, Directory: { Data: 'DATA' } }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => cap.native, getPlatform: () => 'android' },
}));
vi.mock('@/infrastructure/cloud-ai', () => ({ isOnline: () => online.value }));
vi.mock('@/infrastructure/ollama', () => ({ getOllamaConfig: () => null }));

import { getEmbeddingBackend } from '../embedding-provider';
import { LiteRtEmbeddingProvider } from '../providers/litert-embedding.provider';
import {
  SEARCH_MODEL_SHA256,
  SEARCH_MODEL_SIZE_BYTES,
  downloadSearchModel,
  getReadySearchModelPath,
  refreshSearchModelState,
} from '../services/search-model.service';

beforeEach(() => {
  vi.clearAllMocks();
  cap.native = true;
  online.value = false;
  fs.getUri.mockResolvedValue({ uri: 'file:///data/files/embeddinggemma_300m.litertlm' });
  fs.stat.mockResolvedValue({ size: SEARCH_MODEL_SIZE_BYTES });
  plugin.addListener.mockResolvedValue({ remove: vi.fn() });
  plugin.deleteModel.mockResolvedValue(undefined);
});

describe('LiteRtEmbeddingProvider', () => {
  it('adds EmbeddingGemma task prefixes and batches the native calls', async () => {
    plugin.embedTexts.mockImplementation(({ texts }: { texts: string[] }) =>
      Promise.resolve({ embeddings: texts.map(() => [1, 0]) })
    );
    const provider = new LiteRtEmbeddingProvider('/m');
    const texts = Array.from({ length: 10 }, (_, i) => `doc ${i}`);
    const out = await provider.embed(texts);
    expect(out).toHaveLength(10);
    expect(plugin.embedTexts).toHaveBeenCalledTimes(2); // 8 + 2
    expect(sentText(0)).toBe('title: none | text: doc 0');
    await provider.embed(['rent'], 'query');
    expect(sentText(2)).toBe('task: search result | query: rent');
  });

  it('rejects a mismatched vector count', async () => {
    plugin.embedTexts.mockResolvedValue({ embeddings: [] });
    await expect(new LiteRtEmbeddingProvider('/m').embed(['a'])).rejects.toThrow(
      /unexpected number/
    );
  });

  it('clamps oversized input below the native token limit', async () => {
    plugin.embedTexts.mockResolvedValue({ embeddings: [[1]] });
    await new LiteRtEmbeddingProvider('/m').embed(['x'.repeat(5000)]);
    expect(sentText(0).length).toBeLessThan(1300);
  });
});

describe('search model lifecycle + backend selection', () => {
  it('is unavailable until the model is ready, then selects the on-device backend', async () => {
    fs.stat.mockResolvedValue({ size: 5 }); // partial file on disk
    expect(await refreshSearchModelState()).toBe(false);
    expect(getEmbeddingBackend()).toBeNull();

    fs.stat.mockResolvedValue({ size: SEARCH_MODEL_SIZE_BYTES });
    expect(await refreshSearchModelState()).toBe(true);
    expect(getReadySearchModelPath()).toBe('/data/files/embeddinggemma_300m.litertlm');
    expect(getEmbeddingBackend()?.id).toBe('device');
  });

  it('prefers the cloud backend when online (demo builds)', async () => {
    await refreshSearchModelState();
    online.value = true;
    expect(getEmbeddingBackend()?.id).toBe('cloud');
  });

  it('downloads with a tag, verifies the checksum, and marks ready', async () => {
    fs.stat.mockRejectedValueOnce(new Error('missing')); // not on disk yet
    plugin.downloadModel.mockResolvedValue({ path: '/p' });
    plugin.sha256File.mockResolvedValue({ hash: SEARCH_MODEL_SHA256.toUpperCase() });
    await downloadSearchModel(vi.fn());
    expect(plugin.downloadModel).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'search-model', expectedBytes: SEARCH_MODEL_SIZE_BYTES })
    );
    expect(getReadySearchModelPath()).not.toBeNull();
  });

  it('deletes the file and stays unavailable when the checksum is wrong', async () => {
    fs.stat.mockRejectedValueOnce(new Error('missing'));
    plugin.downloadModel.mockResolvedValue({ path: '/p' });
    plugin.sha256File.mockResolvedValue({ hash: 'deadbeef' });
    await expect(downloadSearchModel(vi.fn())).rejects.toThrow(/integrity/);
    expect(plugin.deleteModel).toHaveBeenCalled();
    expect(getReadySearchModelPath()).toBeNull();
  });

  it('only forwards progress for its own tag (never the chat model bar)', async () => {
    fs.stat.mockRejectedValueOnce(new Error('missing'));
    plugin.downloadModel.mockResolvedValue({ path: '/p' });
    plugin.sha256File.mockResolvedValue({ hash: SEARCH_MODEL_SHA256 });
    let listener: (e: { progress: number; tag?: string }) => void = () => undefined;
    plugin.addListener.mockImplementation((_n: string, cb: typeof listener) => {
      listener = cb;
      return Promise.resolve({ remove: vi.fn() });
    });
    const onProgress = vi.fn();
    const done = downloadSearchModel(onProgress);
    await vi.waitFor(() => expect(plugin.downloadModel).toHaveBeenCalled());
    listener({ progress: 10 }); // chat model
    listener({ progress: 40, tag: 'search-model' });
    await done;
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(40);
  });
});
