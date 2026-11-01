import { ollamaPost, type FetchLike } from '@/infrastructure/ollama';
import { withEmbeddingGemmaPrefix } from '../embedding-gemma-prefixes';
import type { EmbeddingProvider } from '../types';

export interface OllamaEmbeddingConfig {
  /** e.g. `http://localhost:11434` */
  baseUrl: string;
  /** e.g. `embeddinggemma` */
  model: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
}

/** Embeds text through a local Ollama server's `/api/embed` batch endpoint. */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly config: OllamaEmbeddingConfig) {}

  embed(texts: string[], kind: 'query' | 'document' = 'document'): Promise<number[][]> {
    return this.request(texts.map((t) => withEmbeddingGemmaPrefix(t, kind)));
  }

  private async request(inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) {
      return [];
    }
    const body = await ollamaPost<{ embeddings?: number[][] }>(
      this.config.baseUrl,
      '/api/embed',
      { model: this.config.model, input: inputs },
      this.config.fetchImpl
    );
    if (!body.embeddings || body.embeddings.length !== inputs.length) {
      throw new Error('Ollama embed returned an unexpected number of vectors');
    }
    return body.embeddings;
  }
}
