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
 */
export class CapgoLLMWeb extends WebPlugin implements LLMPlugin {
  private notSupported(): never {
    throw this.unavailable('AI Assistant is Android-only in this app; see isAiSupported().');
  }

  async createChat(): ReturnType<LLMPlugin['createChat']> {
    this.notSupported();
  }

  async sendMessage(): ReturnType<LLMPlugin['sendMessage']> {
    this.notSupported();
  }

  async getReadiness(): ReturnType<LLMPlugin['getReadiness']> {
    return { readiness: 'not-loaded' };
  }

  async setModel(_options: ModelOptions): ReturnType<LLMPlugin['setModel']> {
    this.notSupported();
  }

  async downloadModel(_options: DownloadModelOptions): Promise<DownloadModelResult> {
    this.notSupported();
  }

  async getPluginVersion(): ReturnType<LLMPlugin['getPluginVersion']> {
    return { version: 'web-unsupported' };
  }

  async sha256File(): ReturnType<LLMPlugin['sha256File']> {
    this.notSupported();
  }

  async deleteModel(): ReturnType<LLMPlugin['deleteModel']> {
    this.notSupported();
  }

  async resolveToolCall(): ReturnType<LLMPlugin['resolveToolCall']> {
    this.notSupported();
  }

  async getCapabilities(): Promise<AiCapabilities> {
    this.notSupported();
  }
}
