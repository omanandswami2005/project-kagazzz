import { isOnline } from '@/infrastructure/cloud-ai';
import { getOllamaConfig } from '@/infrastructure/ollama';
import { CloudEmbeddingProvider } from './providers/cloud-embedding.provider';
import { LiteRtEmbeddingProvider } from './providers/litert-embedding.provider';
import { getReadySearchModelPath } from './services/search-model.service';
import { OllamaEmbeddingProvider } from './providers/ollama-embedding.provider';
import type { EmbeddingProvider } from './types';

export type EmbeddingBackendId = 'cloud' | 'ollama' | 'device';

/**
 * The embedding backend for the current mode: Vertex AI when online (demo
 * builds), else the local Ollama model when configured (demo builds), else
 * EmbeddingGemma on the phone once its optional model is downloaded, else null
 * — semantic search is then unavailable until the user downloads it. Resolved
 * per call so the online/offline switch takes effect at once.
 */
export function getEmbeddingBackend(): {
  id: EmbeddingBackendId;
  provider: EmbeddingProvider;
} | null {
  if (isOnline()) {
    return { id: 'cloud', provider: new CloudEmbeddingProvider() };
  }
  const config = getOllamaConfig();
  if (config) {
    return {
      id: 'ollama',
      provider: new OllamaEmbeddingProvider({
        baseUrl: config.baseUrl,
        model: config.embeddingModel,
      }),
    };
  }
  const modelPath = getReadySearchModelPath();
  return modelPath ? { id: 'device', provider: new LiteRtEmbeddingProvider(modelPath) } : null;
}

export function getEmbeddingProvider(): EmbeddingProvider | null {
  return getEmbeddingBackend()?.provider ?? null;
}
