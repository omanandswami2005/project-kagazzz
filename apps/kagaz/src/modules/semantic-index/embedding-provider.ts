import { isOnline } from '@/infrastructure/cloud-ai';
import { getOllamaConfig } from '@/infrastructure/ollama';
import { CloudEmbeddingProvider } from './providers/cloud-embedding.provider';
import { OllamaEmbeddingProvider } from './providers/ollama-embedding.provider';
import type { EmbeddingProvider } from './types';

/**
 * The embedding backend for the current mode: Vertex AI when online, else the
 * local Ollama model when configured, else null (semantic search unavailable).
 * Resolved per call so the online/offline switch takes effect immediately.
 */
export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (isOnline()) {
    return new CloudEmbeddingProvider();
  }
  const config = getOllamaConfig();
  return config ? new OllamaEmbeddingProvider({ baseUrl: config.baseUrl, model: config.embeddingModel }) : null;
}
