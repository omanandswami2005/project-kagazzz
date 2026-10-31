import { WebPlugin } from '@capacitor/core';

import type {
  AiCapabilities,
  DownloadModelOptions,
  DownloadModelResult,
  LLMPlugin,
  ModelOptions,
} from './definitions';

/**
 * Kagaz fork: the app gates the AI Assistant entry point behind
 * `isAiSupported()` (Android-native only, see
 * docs/architecture/05-ai-assistant-module.md §3.3) — this web
 * implementation is never reached in practice. Upstream's web
 * implementation loaded `@mediapipe/tasks-genai`'s WASM runtime from a CDN
 * (`cdn.jsdelivr.net`) at call time; that's exactly the "runtime network
 * dependency" CLAUDE.md's media-library rule warns about, so it's removed
 * here rather than kept as unreachable-but-present dead weight.
 *
 * No method here actually awaits anything (each either throws
 * synchronously or returns a fixed value), so none are declared `async` —
 * they return an already-settled Promise directly instead.
 */
export class CapgoLLMWeb extends WebPlugin implements LLMPlugin {
  private notSupported<T>(): Promise<T> {
    return Promise.reject(this.unavailable('AI Assistant is Android-only in this app; see isAiSupported().'));
  }

  createChat(): ReturnType<LLMPlugin['createChat']> {
    return this.notSupported();
  }

  sendMessage(): ReturnType<LLMPlugin['sendMessage']> {
    return this.notSupported();
  }

  getReadiness(): ReturnType<LLMPlugin['getReadiness']> {
    return Promise.resolve({ readiness: 'not-loaded' });
  }

  setModel(_options: ModelOptions): ReturnType<LLMPlugin['setModel']> {
    return this.notSupported();
  }

  downloadModel(_options: DownloadModelOptions): Promise<DownloadModelResult> {
    return this.notSupported();
  }

  embedTexts(): ReturnType<LLMPlugin['embedTexts']> {
    return this.notSupported();
  }

  getPluginVersion(): ReturnType<LLMPlugin['getPluginVersion']> {
    return Promise.resolve({ version: 'web-unsupported' });
  }

  sha256File(): ReturnType<LLMPlugin['sha256File']> {
    return this.notSupported();
  }

  deleteModel(): ReturnType<LLMPlugin['deleteModel']> {
    return this.notSupported();
  }

  resolveToolCall(): ReturnType<LLMPlugin['resolveToolCall']> {
    return this.notSupported();
  }

  getCapabilities(): Promise<AiCapabilities> {
    return this.notSupported();
  }
}
