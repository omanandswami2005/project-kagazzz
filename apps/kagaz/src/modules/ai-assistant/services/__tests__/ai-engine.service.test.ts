import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners: Record<string, (data: unknown) => void> = {};
const plugin = vi.hoisted(() => ({
  addListener: vi.fn(),
  downloadModel: vi.fn(),
  sha256File: vi.fn(),
  deleteModel: vi.fn(),
  setModel: vi.fn(),
  getCapabilities: vi.fn(),
}));
const capacitorMock = vi.hoisted(() => ({ isNativePlatform: vi.fn(), getPlatform: vi.fn() }));
const filesystemMock = vi.hoisted(() => ({ getUri: vi.fn(), stat: vi.fn() }));

vi.mock('@kagaz/capacitor-llm-litert', () => ({ CapacitorLlmLiteRT: plugin }));
vi.mock('@capacitor/core', () => ({ Capacitor: capacitorMock }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: filesystemMock,
  Directory: { Data: 'DATA' },
}));

import {
  AiError,
  deleteDownloadedModel,
  downloadAndVerify,
  hasDownloadedModel,
  isAiSupported,
  loadModel,
  MODEL_SHA256,
  modelSizeOnDiskBytes,
} from '../ai-engine.service';

beforeEach(() => {
  for (const k of Object.keys(listeners)) delete listeners[k];
  vi.clearAllMocks();
  plugin.addListener.mockImplementation((event: string, cb: (d: unknown) => void) => {
    listeners[event] = cb;
    return Promise.resolve({ remove: vi.fn().mockResolvedValue(undefined) });
  });
  filesystemMock.getUri.mockResolvedValue({ uri: 'file:///data/user/0/in.kagaz.app/files/model.litertlm' });
  plugin.deleteModel.mockResolvedValue(undefined);
});

describe('isAiSupported (F-13)', () => {
  it('true only on native Android', () => {
    capacitorMock.isNativePlatform.mockReturnValue(true);
    capacitorMock.getPlatform.mockReturnValue('android');
    expect(isAiSupported()).toBe(true);
  });

  it('false on iOS', () => {
    capacitorMock.isNativePlatform.mockReturnValue(true);
    capacitorMock.getPlatform.mockReturnValue('ios');
    expect(isAiSupported()).toBe(false);
  });

  it('false on web', () => {
    capacitorMock.isNativePlatform.mockReturnValue(false);
    capacitorMock.getPlatform.mockReturnValue('web');
    expect(isAiSupported()).toBe(false);
  });
});

describe('hasDownloadedModel / modelSizeOnDiskBytes', () => {
  it('true + size when the file stats successfully', async () => {
    filesystemMock.stat.mockResolvedValue({ size: 497_664_000 });
    expect(await hasDownloadedModel()).toBe(true);
    expect(await modelSizeOnDiskBytes()).toBe(497_664_000);
  });

  it('false + null when stat throws (no file yet)', async () => {
    filesystemMock.stat.mockRejectedValue(new Error('ENOENT'));
    expect(await hasDownloadedModel()).toBe(false);
    expect(await modelSizeOnDiskBytes()).toBeNull();
  });
});

describe('downloadAndVerify (F-13)', () => {
  it('downloads, verifies, and returns the path on a checksum match', async () => {
    filesystemMock.stat.mockRejectedValue(new Error('ENOENT')); // not present yet
    plugin.downloadModel.mockResolvedValue({ path: '/data/model.litertlm' });
    plugin.sha256File.mockResolvedValue({ hash: MODEL_SHA256.toUpperCase() }); // case-insensitive match

    const onProgress = vi.fn();
    const path = await downloadAndVerify(onProgress);

    expect(path).toBe('/data/model.litertlm');
    expect(plugin.downloadModel).toHaveBeenCalledOnce();
    listeners.downloadProgress?.({ progress: 55 });
    expect(onProgress).toHaveBeenCalledWith(55);
  });

  it('skips the download when a model file already exists, but still verifies', async () => {
    filesystemMock.stat.mockResolvedValue({ size: 1 }); // already present
    plugin.sha256File.mockResolvedValue({ hash: MODEL_SHA256 });

    await downloadAndVerify(vi.fn());

    expect(plugin.downloadModel).not.toHaveBeenCalled();
    expect(plugin.sha256File).toHaveBeenCalledOnce();
  });

  it('deletes the file and throws AiError on a checksum mismatch', async () => {
    filesystemMock.stat.mockRejectedValue(new Error('ENOENT'));
    plugin.downloadModel.mockResolvedValue({ path: '/data/model.litertlm' });
    plugin.sha256File.mockResolvedValue({ hash: 'deadbeef'.repeat(8) });

    await expect(downloadAndVerify(vi.fn())).rejects.toThrow(AiError);
    expect(plugin.deleteModel).toHaveBeenCalledWith({ path: '/data/model.litertlm' });
  });

  it('wraps a download failure as AiError', async () => {
    filesystemMock.stat.mockRejectedValue(new Error('ENOENT'));
    plugin.downloadModel.mockRejectedValue(new Error('network down'));

    await expect(downloadAndVerify(vi.fn())).rejects.toThrow(AiError);
  });
});

describe('loadModel (F-13)', () => {
  it('loads on gpu when it succeeds', async () => {
    plugin.setModel.mockResolvedValue(undefined);
    plugin.getCapabilities.mockResolvedValue({ backend: 'gpu', loadTimeMs: 900 });

    const result = await loadModel('/data/model.litertlm', []);

    expect(result).toEqual({ backend: 'gpu', loadTimeMs: 900 });
    expect(plugin.setModel).toHaveBeenCalledWith({
      path: '/data/model.litertlm',
      modelType: 'litertlm',
      backend: 'gpu',
      tools: [],
    });
  });

  it('retries on cpu when the gpu load fails', async () => {
    plugin.setModel.mockRejectedValueOnce(new Error('gpu delegate unavailable')).mockResolvedValueOnce(undefined);
    plugin.getCapabilities.mockResolvedValue({ backend: 'cpu', loadTimeMs: 2100 });

    const result = await loadModel('/data/model.litertlm', []);

    expect(result.backend).toBe('cpu');
    expect(plugin.setModel).toHaveBeenCalledTimes(2);
    expect(plugin.setModel).toHaveBeenLastCalledWith(
      expect.objectContaining({ backend: 'cpu' })
    );
  });

  it('throws AiError when both gpu and cpu loads fail', async () => {
    plugin.setModel.mockRejectedValue(new Error('out of memory'));
    await expect(loadModel('/data/model.litertlm', [])).rejects.toThrow(AiError);
  });
});

describe('deleteDownloadedModel', () => {
  it('resolves the path and calls the plugin delete', async () => {
    await deleteDownloadedModel();
    expect(plugin.deleteModel).toHaveBeenCalledWith({
      path: '/data/user/0/in.kagaz.app/files/model.litertlm',
    });
  });
});
