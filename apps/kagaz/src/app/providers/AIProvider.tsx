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
import { getOllamaEngine } from '@/modules/ai-assistant/services/chat-engine.registry';
import { getOllamaConfig } from '@/infrastructure/ollama';

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
  /**
   * Which engine answers: the on-device native model, or a local Ollama server
   * (demo builds). For `ollama`, `serverUrl` is where prompts and tool results
   * are sent — the UI must not claim "nothing leaves your device".
   */
  engine: 'litert' | 'ollama';
  serverUrl: string | null;
  /** Size of the shipped model — for the Settings "Download (~N MB)" label before download starts. */
  modelSizeBytes: number;
  /**
   * User opt-in for the experimental GPU delegate (persisted). Off by
   * default — see ai-engine.service.ts's `loadModel()` doc comment for why
   * GPU isn't attempted unless the user explicitly asks for it.
   */
  preferGpu: boolean;
  setPreferGpu: (next: boolean) => void;
  /** Downloads-if-needed, verifies, and loads the model. Registers `tools` for this session's chat. */
  activate: (tools: ToolDescriptor[]) => Promise<void>;
  /** Deletes the cached model file. Resets status to 'not-downloaded'. */
  remove: () => Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

/**
 * Non-sensitive UI preference — same lightweight localStorage pattern as
 * ThemeProvider's THEME_STORAGE_KEY, not the SQLCipher DB (no need for
 * DB-at-rest protection for "did the user opt into experimental GPU").
 */
const PREFER_GPU_STORAGE_KEY = 'kagaz:ai-gpu-experimental';

function readPreferGpu(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(PREFER_GPU_STORAGE_KEY) === 'true';
}

function storePreferGpu(value: boolean): void {
  try {
    localStorage.setItem(PREFER_GPU_STORAGE_KEY, String(value));
  } catch {
    // Private mode / quota — persistence is best-effort, not fatal.
  }
}

/** Provides AI engine status app-wide. */
export function AIProvider({ children }: { children: ReactNode }): ReactNode {
  // Demo builds with a local Ollama server work on any platform, not just Android.
  const supported = useMemo(() => isAiSupported() || getOllamaEngine() !== null, []);
  const [status, setStatus] = useState<AiStatus>(supported ? 'not-downloaded' : 'unsupported');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<LoadResult | null>(null);
  const [preferGpu, setPreferGpuState] = useState<boolean>(readPreferGpu);

  const setPreferGpu = useCallback((next: boolean): void => {
    setPreferGpuState(next);
    storePreferGpu(next);
  }, []);

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

  const activate = useCallback(
    async (tools: ToolDescriptor[]): Promise<void> => {
      setErrorMessage(null);
      const ollama = getOllamaEngine();
      if (ollama) {
        // No download / checksum / local model load: just confirm the server and model are there.
        setStatus('loading');
        const startedAt = Date.now();
        try {
          ollama.setTools(tools);
          await ollama.checkReady();
          setCapabilities({ backend: 'ollama', loadTimeMs: Date.now() - startedAt });
          setStatus('ready');
        } catch (error) {
          logger.warn({ event: 'ai.ollama.not_ready', err: { message: String(error) } });
          setErrorMessage(error instanceof Error ? error.message : 'Ollama is not available');
          setStatus('error');
        }
        return;
      }
      setStatus('downloading');
      setDownloadProgress(0);
      try {
        const path = await downloadAndVerify((percent) => setDownloadProgress(percent));
        setStatus('loading');
        const loaded = await loadModel(path, tools, preferGpu);
        setCapabilities(loaded);
        setStatus('ready');
      } catch (error) {
        const message = error instanceof AiError ? error.message : 'AI Assistant failed to start';
        setErrorMessage(message);
        setStatus('error');
      }
    },
    [preferGpu]
  );

  const remove = useCallback(async (): Promise<void> => {
    if (getOllamaEngine()) {
      // Nothing is stored on-device for the Ollama engine.
      setCapabilities(null);
      setStatus('not-downloaded');
      return;
    }
    try {
      await deleteDownloadedModel();
      setCapabilities(null);
      setDownloadProgress(0);
      setStatus('not-downloaded');
    } catch (error) {
      // Bug-audit fix: this used to have no error handling at all — a
      // failed native delete left the status stuck at 'ready' with no user
      // feedback, and its only call site (`void ai.remove()`) turned the
      // rejection into an unhandled promise rejection. Surface it the same
      // way activate() surfaces a load failure.
      logger.warn({ event: 'ai.model.delete_failed', err: { message: String(error) } });
      setErrorMessage('Failed to delete the AI model');
      setStatus('error');
    }
  }, []);

  const value = useMemo<AiContextValue>(
    () => ({
      status,
      downloadProgress,
      errorMessage,
      capabilities,
      engine: getOllamaEngine() ? 'ollama' : 'litert',
      serverUrl: getOllamaConfig()?.baseUrl ?? null,
      modelSizeBytes: MODEL_SIZE_BYTES,
      preferGpu,
      setPreferGpu,
      activate,
      remove,
    }),
    [status, downloadProgress, errorMessage, capabilities, preferGpu, setPreferGpu, activate, remove]
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
