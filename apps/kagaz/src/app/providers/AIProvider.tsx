/**
 * AI provider (F-13, 05-ai-assistant-module.md §3). The mount point for the
 * on-device LiteRT-LM engine's lifecycle — download, verify, load, ready,
 * delete. Model loading is deliberately lazy: mounting this provider does
 * NOT download or load anything on its own (§10.3 "AI engine is only
 * loaded when user first opens the chat") — it only determines
 * `isAiSupported()` and whether a complete model file already exists on disk
 * (→ status `downloaded`, so a restart never asks to download again).
 * Model management (download / delete) lives on the AI model page
 * (`/ai-assistant`, `download()` / `remove()`); the chat calls `activate()`
 * on open to verify + load an already-downloaded model.
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

/**
 * Lifecycle of the on-device model.
 * - `checking`: the one-time on-disk check at startup has not finished (no button yet — avoids a
 *   flash of "Download" for a user who already has the model).
 * - `downloaded`: the verified-size model file is on disk but not loaded into memory. This is the
 *   state after every cold start once the model has been downloaded — the app must never offer
 *   "Download" again here, only "Load" (chat does it automatically) and "Delete".
 */
export type AiStatus =
  | 'unsupported'
  | 'checking'
  | 'not-downloaded'
  | 'downloading'
  | 'downloaded'
  | 'loading'
  | 'ready'
  | 'error';

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
   * True when a complete model file is on disk — independent of `status`, so the management page
   * can offer Delete even after a load error, and Storage can count the space it uses.
   */
  modelOnDisk: boolean;
  /** Size of the shipped model — for the "Download (~N MB)" label and the Storage line. */
  modelSizeBytes: number;
  /**
   * User opt-in for the experimental GPU delegate (persisted). Off by
   * default — see ai-engine.service.ts's `loadModel()` doc comment for why
   * GPU isn't attempted unless the user explicitly asks for it.
   */
  preferGpu: boolean;
  setPreferGpu: (next: boolean) => void;
  /** Downloads and verifies the model without loading it (management page). Ends in `downloaded`. */
  download: () => Promise<void>;
  /**
   * Downloads-if-needed, verifies, and loads the model. Registers `tools` for this session's chat.
   * The chat calls this on open when the model is already `downloaded`.
   */
  activate: (tools: ToolDescriptor[]) => Promise<void>;
  /** Deletes the model file. Resets status to 'not-downloaded'. */
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
  const supported = useMemo(() => isAiSupported(), []);
  const [status, setStatus] = useState<AiStatus>(supported ? 'checking' : 'unsupported');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<LoadResult | null>(null);
  const [modelOnDisk, setModelOnDisk] = useState(false);
  const [preferGpu, setPreferGpuState] = useState<boolean>(readPreferGpu);

  const setPreferGpu = useCallback((next: boolean): void => {
    setPreferGpuState(next);
    storePreferGpu(next);
  }, []);

  // One-time check for a model left over from a previous session — a file stat (complete size),
  // not a load. This is what makes a downloaded model survive an app restart in the UI.
  useEffect(() => {
    if (!supported) {
      return;
    }
    let cancelled = false;
    void hasDownloadedModel().then((exists) => {
      if (cancelled) {
        return;
      }
      setModelOnDisk(exists);
      // Only move out of `checking` — never clobber a state the user already started (e.g. a download).
      setStatus((current) => (current === 'checking' ? (exists ? 'downloaded' : 'not-downloaded') : current));
      if (exists) {
        logger.info({ event: 'ai.model.found_on_disk' });
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [supported]);

  const fetchModel = useCallback(async (): Promise<string> => {
    setStatus('downloading');
    setDownloadProgress(0);
    const path = await downloadAndVerify((percent) => setDownloadProgress(percent));
    setModelOnDisk(true);
    return path;
  }, []);

  const fail = useCallback((error: unknown, fallback: string): void => {
    setErrorMessage(error instanceof AiError ? error.message : fallback);
    setStatus('error');
    // A checksum failure deletes the file; re-check so the page shows Download vs Delete correctly.
    void hasDownloadedModel().then(setModelOnDisk);
  }, []);

  const download = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await fetchModel();
      setStatus('downloaded');
    } catch (error) {
      fail(error, 'Failed to download the AI model');
    }
  }, [fetchModel, fail]);

  const activate = useCallback(
    async (tools: ToolDescriptor[]): Promise<void> => {
      setErrorMessage(null);
      try {
        // On disk already: downloadAndVerify skips the download and only re-verifies the checksum.
        const path = modelOnDisk ? await downloadAndVerify(() => undefined) : await fetchModel();
        setStatus('loading');
        const loaded = await loadModel(path, tools, preferGpu);
        setCapabilities(loaded);
        setStatus('ready');
      } catch (error) {
        fail(error, 'AI Assistant failed to start');
      }
    },
    [preferGpu, modelOnDisk, fetchModel, fail]
  );

  const remove = useCallback(async (): Promise<void> => {
    try {
      await deleteDownloadedModel();
      setCapabilities(null);
      setDownloadProgress(0);
      setModelOnDisk(false);
      setErrorMessage(null);
      setStatus('not-downloaded');
    } catch (error) {
      // Bug-audit fix: a failed native delete used to leave the status stuck
      // with no feedback and an unhandled rejection. Surface it instead.
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
      modelOnDisk,
      modelSizeBytes: MODEL_SIZE_BYTES,
      preferGpu,
      setPreferGpu,
      download,
      activate,
      remove,
    }),
    [status, downloadProgress, errorMessage, capabilities, modelOnDisk, preferGpu, setPreferGpu, download, activate, remove]
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
