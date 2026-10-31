/**
 * On-device AI engine gate (F-13, 05-ai-assistant-module.md §3). Wraps the
 * native LiteRT-LM plugin (`@kagaz/capacitor-llm-litert`, a Kagaz fork of
 * `@capgo/capacitor-llm` — see that package's own README for the diff)
 * behind a testable interface, matching the same posture as
 * speech-recognition.service.ts for F-15.
 *
 * Runs 100% on-device via Android's native ML stack (NNAPI/GPU/CPU
 * delegate) — no WebView, no WebGPU. Model integrity is checksum-verified
 * on every load, not just the first download (`[SEC]` §5).
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { CapacitorLlmLiteRT, type DownloadProgressEvent, type ToolDescriptor } from '@kagaz/capacitor-llm-litert';
import { log } from '@/core/logging';

const logger = log('ai-assistant');

/** litert-community/Qwen3-0.6B's mixed-INT4 artifact — Apache-2.0, ~498 MB. */
export const MODEL_FILENAME = 'qwen3_0_6b_mixed_int4.litertlm';
export const MODEL_URL =
  'https://huggingface.co/litert-community/Qwen3-0.6B/resolve/main/qwen3_0_6b_mixed_int4.litertlm';
export const MODEL_SHA256 = 'b1baab462f6be49d70eada79d715c2c52cd9ece0cad00bddf6a2c097d23498e9';
export const MODEL_SIZE_BYTES = 497_664_000;

/** Mirrors 05-ai-assistant-module.md §9.1 (renamed from the old WebGPU-era set). */
export type AiErrorCode =
  | 'PLATFORM_NOT_SUPPORTED'
  | 'MODEL_DOWNLOAD_FAILED'
  | 'MODEL_LOAD_FAILED'
  | 'INFERENCE_FAILED'
  | 'TOOL_EXECUTION_FAILED'
  | 'TOOL_CALL_TIMEOUT'
  | 'CONTEXT_TOO_LONG'
  | 'NOT_INITIALIZED';

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}

/** Same posture as isScanningSupported()/voice's `supported` — Android-native only. */
export function isAiSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function resolveModelPath(): Promise<string> {
  const { uri } = await Filesystem.getUri({ path: MODEL_FILENAME, directory: Directory.Data });
  return uri.replace(/^file:\/\//, '');
}

/** File exists at the expected on-disk path — existence only, not checksum-verified. */
export async function hasDownloadedModel(): Promise<boolean> {
  try {
    await Filesystem.stat({ path: MODEL_FILENAME, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

/** Bytes on disk, or null if no model file exists yet — for the Settings "size" line. */
export async function modelSizeOnDiskBytes(): Promise<number | null> {
  try {
    const stat = await Filesystem.stat({ path: MODEL_FILENAME, directory: Directory.Data });
    return stat.size;
  } catch {
    return null;
  }
}

/**
 * Downloads the model if it isn't already on disk, then verifies its
 * checksum either way — a corrupted or tampered cache file must never be
 * handed to the engine, first download or not.
 */
export async function downloadAndVerify(onProgress: (percent: number) => void): Promise<string> {
  const alreadyPresent = await hasDownloadedModel();
  let path: string;

  if (alreadyPresent) {
    path = await resolveModelPath();
  } else {
    const subscription = await CapacitorLlmLiteRT.addListener('downloadProgress', (event: DownloadProgressEvent) => {
      onProgress(event.progress);
    });
    try {
      const result = await CapacitorLlmLiteRT.downloadModel({ url: MODEL_URL, filename: MODEL_FILENAME });
      path = result.path;
    } catch (error) {
      logger.warn({ event: 'ai.model.download_failed', err: { message: String(error) } });
      throw new AiError('MODEL_DOWNLOAD_FAILED', 'Failed to download the AI model');
    } finally {
      await subscription.remove();
    }
  }

  const { hash } = await CapacitorLlmLiteRT.sha256File({ path });
  if (hash.toLowerCase() !== MODEL_SHA256.toLowerCase()) {
    await CapacitorLlmLiteRT.deleteModel({ path }).catch(() => undefined);
    logger.warn({ event: 'ai.model.checksum_mismatch' });
    throw new AiError('MODEL_DOWNLOAD_FAILED', 'Downloaded model failed integrity verification');
  }

  logger.info({ event: 'ai.model.verified' });
  return path;
}

/** What backend actually ended up loaded, and how long it took — for the Settings "ready" line. */
export interface LoadResult {
  /** `ollama` = a local server and `cloud` = Google Vertex AI (demo builds) — neither is an on-device backend. */
  backend: 'cpu' | 'gpu' | 'ollama' | 'cloud';
  loadTimeMs: number;
}

/**
 * Loads the model. Defaults to the CPU delegate — NOT GPU-first. This used
 * to try GPU first and catch a failure down to CPU, reasoning that a
 * slower ready state beats a device that can't use the feature. That
 * reasoning assumed a GPU load failure surfaces as a catchable JS
 * rejection; on-device testing showed a real device instead **crashing the
 * whole app process** partway through "loading" — a native GPU-delegate
 * OOM/driver fault kills the process before any JS `try/catch` ever runs,
 * so the CPU fallback never gets a chance to execute. The plugin's own
 * `ModelOptions.backend` doc comment already says "Use `cpu` for stable
 * long generations" and that iOS's own default is "CPU then falls back to
 * GPU" — Android's default should be no less conservative.
 *
 * `preferGpu` (default false) is a user-driven, explicit opt-in — Settings
 * → AI Assistant's "Experimental GPU acceleration" toggle
 * (`AIProvider.preferGpu`) — for anyone who wants to try it despite the
 * risk above. When set, this restores the old try-GPU-then-CPU-fallback
 * behavior; when unset, GPU is never attempted at all. There is still no
 * real pre-flight GPU-capability check (e.g. device RAM headroom) — the
 * toggle exists precisely because that check doesn't exist yet, so the
 * risk is disclosed to the user instead of silently applied to everyone.
 */
export async function loadModel(
  path: string,
  tools: ToolDescriptor[],
  preferGpu = false
): Promise<LoadResult> {
  if (preferGpu) {
    try {
      await CapacitorLlmLiteRT.setModel({ path, modelType: 'litertlm', backend: 'gpu', tools });
      return logLoaded();
    } catch (gpuError) {
      // A genuine native crash never reaches this catch — see the doc
      // comment above. This only catches a *graceful* GPU rejection.
      logger.info({ event: 'ai.model.gpu_load_failed', err: { message: String(gpuError) } });
    }
  }

  try {
    await CapacitorLlmLiteRT.setModel({ path, modelType: 'litertlm', backend: 'cpu', tools });
  } catch (cpuError) {
    // Surface the native engine's real message (e.g. an out-of-memory or
    // engine-init failure reason) instead of a generic string — it was
    // being logged but silently discarded from the AiError the UI shows,
    // which made a real device failure impossible to diagnose from the
    // screen alone.
    const detail = cpuError instanceof Error ? cpuError.message : String(cpuError);
    logger.warn({ event: 'ai.model.load_failed', err: { message: detail } });
    throw new AiError('MODEL_LOAD_FAILED', `Failed to load the AI model on this device: ${detail}`);
  }
  return logLoaded();
}

async function logLoaded(): Promise<LoadResult> {
  const capabilities = await CapacitorLlmLiteRT.getCapabilities();
  logger.info({
    event: 'ai.model.loaded',
    backend: capabilities.backend,
    loadTimeMs: capabilities.loadTimeMs,
  });
  return capabilities;
}

export async function deleteDownloadedModel(): Promise<void> {
  const path = await resolveModelPath();
  await CapacitorLlmLiteRT.deleteModel({ path });
  logger.info({ event: 'ai.model.deleted' });
}
