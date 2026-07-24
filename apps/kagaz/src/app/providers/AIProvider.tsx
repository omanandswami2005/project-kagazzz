/**
 * AI provider (F-13, 05-ai-assistant-module.md §3). The mount point for the
 * on-device LiteRT-LM engine's lifecycle — download, verify, load, ready,
 * delete. Model loading is deliberately lazy: mounting this provider does
 * NOT download or load anything on its own (§10.3 "AI engine is only
 * loaded when user first opens the chat") — it only determines
 * `isAiSupported()` and whether a previously-downloaded model file already
 * exists on disk, both cheap, synchronous-feeling checks. `activate()` is
 * what a caller (Settings → AI Assistant, or the chat's first-run gate)
 * invokes to actually download-if-needed/verify/load.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ToolDescriptor } from '@kagaz/capacitor-llm-litert';
import { log } from '@/core/logging';
import {
  AiError,
  deleteDownloadedModel,
  downloadAndVerify,
  hasDownloadedModel,
  isAiSupported,
  loadModel,
  MODEL_SIZE_BYTES,
  type LoadResult,
} from '@/modules/ai-assistant/services/ai-engine.service';

const logger = log('ai-assistant');

/** Lifecycle of the on-device model. */
export type AiStatus = 'unsupported' | 'not-downloaded' | 'downloading' | 'loading' | 'ready' | 'error';

/** What AIContext exposes. */
export interface AiContextValue {
  status: AiStatus;
  /** 0-100 while status === 'downloading'; meaningless otherwise. */
  downloadProgress: number;
  /** Set only when status === 'error'. */
  errorMessage: string | null;
  /** Set only when status === 'ready'. */
  capabilities: LoadResult | null;
  /** Size of the shipped model — for the Settings "Download (~N MB)" label before download starts. */
  modelSizeBytes: number;
  /** Downloads-if-needed, verifies, and loads the model. Registers `tools` for this session's chat. */
  activate: (tools: ToolDescriptor[]) => Promise<void>;
  /** Deletes the cached model file. Resets status to 'not-downloaded'. */
  remove: () => Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

/** Provides AI engine status app-wide. */
export function AIProvider({ children }: { children: ReactNode }): ReactNode {
  const supported = useMemo(() => isAiSupported(), []);
  const [status, setStatus] = useState<AiStatus>(supported ? 'not-downloaded' : 'unsupported');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<LoadResult | null>(null);

  // One-time check for a model left over from a previous session — cheap
  // (a file stat), not a load. Still 'not-downloaded' either way until
  // activate() actually loads it into memory; this only affects whether
  // activate()'s first phase can skip straight to verify.
  useEffect(() => {
    if (!supported) {
      return;
    }
    let cancelled = false;
    void hasDownloadedModel().then((exists) => {
      if (!cancelled && exists) {
        logger.info({ event: 'ai.model.found_on_disk' });
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [supported]);

  const activate = useCallback(async (tools: ToolDescriptor[]): Promise<void> => {
    setErrorMessage(null);
    setStatus('downloading');
    setDownloadProgress(0);
    try {
      const path = await downloadAndVerify((percent) => setDownloadProgress(percent));
      setStatus('loading');
      const loaded = await loadModel(path, tools);
      setCapabilities(loaded);
      setStatus('ready');
    } catch (error) {
      const message = error instanceof AiError ? error.message : 'AI Assistant failed to start';
      setErrorMessage(message);
      setStatus('error');
    }
  }, []);

  const remove = useCallback(async (): Promise<void> => {
    await deleteDownloadedModel();
    setCapabilities(null);
    setDownloadProgress(0);
    setStatus('not-downloaded');
  }, []);

  const value = useMemo<AiContextValue>(
    () => ({
      status,
      downloadProgress,
      errorMessage,
      capabilities,
      modelSizeBytes: MODEL_SIZE_BYTES,
      activate,
      remove,
    }),
    [status, downloadProgress, errorMessage, capabilities, activate, remove]
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

/** Access the AI engine status; throws outside the provider. */
export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) {
    throw new Error('useAi must be used inside <AIProvider>');
  }
  return ctx;
}
