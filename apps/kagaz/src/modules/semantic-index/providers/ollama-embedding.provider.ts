import type { EmbeddingProvider } from '../types';

export interface OllamaEmbeddingConfig {
  /** e.g. `http://localhost:11434` */
  baseUrl: string;
  /** e.g. `embeddinggemma` */
  model: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** Embeds text through a local Ollama server's `/api/embed` batch endpoint. */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly config: OllamaEmbeddingConfig) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const doFetch = this.config.fetchImpl ?? fetch;
    const response = await doFetch(`${this.config.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.config.model, input: texts }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embed failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as { embeddings?: number[][] };
    if (!body.embeddings || body.embeddings.length !== texts.length) {
      throw new Error('Ollama embed returned an unexpected number of vectors');
    }
    return body.embeddings;
  }
}
