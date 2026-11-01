/**
 * The single place that knows how a local Ollama server is configured
 * (chat, vision OCR and embeddings all read it). Demo-only: unset in real
 * builds, which then never make these calls. A hosted-API fallback (with a
 * PII data-sharing warning) would be a sibling config, not a change here.
 *
 * [SEC] Document images / text leave the WebView for this server; only
 * point it at localhost or a machine you control. The demo-only CSP plugin
 * (`vite-plugins/demo-csp.ts`) refuses production builds that set it.
 */
export interface OllamaConfig {
  /** e.g. `http://localhost:11434` */
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  embeddingModel: string;
}

const DEFAULT_CHAT_MODEL = 'gemma4:e2b';
const DEFAULT_EMBEDDING_MODEL = 'embeddinggemma';

/** Env-derived config, or null when `VITE_OLLAMA_URL` is unset (the shipped default). */
export function getOllamaConfig(): OllamaConfig | null {
  const baseUrl = __KAGAZ_DEMO__ ? (import.meta.env.VITE_OLLAMA_URL as string | undefined) : undefined;
  if (!baseUrl) {
    return null;
  }
  const chatModel = (import.meta.env.VITE_OLLAMA_CHAT_MODEL as string | undefined) ?? DEFAULT_CHAT_MODEL;
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    chatModel,
    visionModel: (import.meta.env.VITE_OLLAMA_VISION_MODEL as string | undefined) ?? chatModel,
    embeddingModel:
      (import.meta.env.VITE_OLLAMA_EMBEDDING_MODEL as string | undefined) ?? DEFAULT_EMBEDDING_MODEL,
  };
}
