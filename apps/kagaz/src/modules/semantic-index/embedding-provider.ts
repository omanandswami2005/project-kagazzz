import { isOnline } from '@/infrastructure/cloud-ai';
import { getOllamaConfig } from '@/infrastructure/ollama';
import { CloudEmbeddingProvider } from './providers/cloud-embedding.provider';
import { OllamaEmbeddingProvider } from './providers/ollama-embedding.provider';
import type { EmbeddingProvider } from './types';

export type EmbeddingBackendId = 'cloud' | 'ollama';

/**
 * The embedding backend for the current mode: Vertex AI when online, else the
 * local Ollama model (EmbeddingGemma) when configured, else null — semantic
 * search is then unavailable (e.g. in the Android build, which has no embedding
 * runtime yet). Resolved per call so the online/offline switch takes effect at once.
 */
export function getEmbeddingBackend(): { id: EmbeddingBackendId; provider: EmbeddingProvider } | null {
  if (isOnline()) {
    return { id: 'cloud', provider: new CloudEmbeddingProvider() };
  }
  const config = getOllamaConfig();
  return config
    ? { id: 'ollama', provider: new OllamaEmbeddingProvider({ baseUrl: config.baseUrl, model: config.embeddingModel }) }
    : null;
}

export function getEmbeddingProvider(): EmbeddingProvider | null {
  return getEmbeddingBackend()?.provider ?? null;
}
