import * as React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '@/modules/ai-assistant/services/ai-engine.service';
import { AIProvider, useAi } from '../AIProvider';

const engine = vi.hoisted(() => ({
  isAiSupported: vi.fn(),
  hasDownloadedModel: vi.fn(),
  downloadAndVerify: vi.fn(),
  loadModel: vi.fn(),
  deleteDownloadedModel: vi.fn(),
}));

vi.mock('@/modules/ai-assistant/services/ai-engine.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/ai-assistant/services/ai-engine.service')>();
  return {
    ...actual,
    isAiSupported: engine.isAiSupported,
    hasDownloadedModel: engine.hasDownloadedModel,
    downloadAndVerify: engine.downloadAndVerify,
    loadModel: engine.loadModel,
    deleteDownloadedModel: engine.deleteDownloadedModel,
  };
});

function wrapper({ children }: { children: React.ReactNode }): React.ReactNode {
  return <AIProvider>{children}</AIProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  engine.isAiSupported.mockReturnValue(true);
  engine.hasDownloadedModel.mockResolvedValue(false);
  engine.downloadAndVerify.mockResolvedValue('/data/model.litertlm');
  engine.loadModel.mockResolvedValue({ backend: 'gpu', loadTimeMs: 1200 });
  engine.deleteDownloadedModel.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AIProvider (F-13)', () => {
  it('starts as unsupported on a platform isAiSupported() rejects', () => {
    engine.isAiSupported.mockReturnValue(false);
    const { result } = renderHook(() => useAi(), { wrapper });
    expect(result.current.status).toBe('unsupported');
  });

  it('starts as not-downloaded on a supported platform', () => {
    const { result } = renderHook(() => useAi(), { wrapper });
    expect(result.current.status).toBe('not-downloaded');
  });

  it('useAi throws outside the provider', () => {
    function AiProbe(): React.ReactNode {
      useAi();
      return null;
    }
    expect(() => render(<AiProbe />)).toThrow('inside <AIProvider>');
  });

  it('activate() transitions downloading -> loading -> ready, forwarding tools', async () => {
    const { result } = renderHook(() => useAi(), { wrapper });

    await act(async () => {
      await result.current.activate([{ name: 'list_documents', descriptionJson: '{}' }]);
    });

    expect(engine.downloadAndVerify).toHaveBeenCalledOnce();
    expect(engine.loadModel).toHaveBeenCalledWith(
      '/data/model.litertlm',
      [{ name: 'list_documents', descriptionJson: '{}' }],
      false
    );
    expect(result.current.status).toBe('ready');
    expect(result.current.capabilities).toEqual({ backend: 'gpu', loadTimeMs: 1200 });
  });

  it('reports download progress while activating', async () => {
    let progressCallback: ((percent: number) => void) | undefined;
    engine.downloadAndVerify.mockImplementation(async (onProgress: (percent: number) => void) => {
      progressCallback = onProgress;
      return '/data/model.litertlm';
    });

    const { result } = renderHook(() => useAi(), { wrapper });

    const activatePromise = act(async () => {
      await result.current.activate([]);
    });
    progressCallback?.(42);
    await activatePromise;

    expect(engine.downloadAndVerify).toHaveBeenCalledOnce();
  });

  it('activate() surfaces AiError messages and sets status to error', async () => {
    engine.downloadAndVerify.mockRejectedValue(new AiError('MODEL_DOWNLOAD_FAILED', 'Checksum mismatch'));

    const { result } = renderHook(() => useAi(), { wrapper });

    await act(async () => {
      await result.current.activate([]);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('Checksum mismatch');
  });

  it('remove() deletes the model and resets to not-downloaded', async () => {
    const { result } = renderHook(() => useAi(), { wrapper });

    await act(async () => {
      await result.current.activate([]);
    });
    expect(result.current.status).toBe('ready');

    await act(async () => {
      await result.current.remove();
    });

    expect(engine.deleteDownloadedModel).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('not-downloaded');
    expect(result.current.capabilities).toBeNull();
  });

  it('preferGpu defaults to false and is off by default in loadModel calls', async () => {
    const { result } = renderHook(() => useAi(), { wrapper });
    expect(result.current.preferGpu).toBe(false);

    await act(async () => {
      await result.current.activate([]);
    });
    expect(engine.loadModel).toHaveBeenCalledWith('/data/model.litertlm', [], false);
  });

  it('setPreferGpu(true) persists and is forwarded to loadModel on the next activate()', async () => {
    const { result } = renderHook(() => useAi(), { wrapper });

    act(() => {
      result.current.setPreferGpu(true);
    });
    expect(result.current.preferGpu).toBe(true);
    expect(localStorage.getItem('kagaz:ai-gpu-experimental')).toBe('true');

    await act(async () => {
      await result.current.activate([]);
    });
    expect(engine.loadModel).toHaveBeenCalledWith('/data/model.litertlm', [], true);
  });

  it('reads a previously-persisted preferGpu=true on mount', () => {
    localStorage.setItem('kagaz:ai-gpu-experimental', 'true');
    const { result } = renderHook(() => useAi(), { wrapper });
    expect(result.current.preferGpu).toBe(true);
  });
});
