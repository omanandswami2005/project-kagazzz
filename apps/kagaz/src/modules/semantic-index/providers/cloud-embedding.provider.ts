import { cloudPost, type FetchLike } from '@/infrastructure/cloud-ai';
import type { EmbeddingProvider } from '../types';

/**
 * Embeds text with Vertex AI `text-embedding-005` through the demo proxy
 * (`/api/ai/embed`), using the model's own query/document task types.
 *
 * [SEC] Text leaves the device for Google Cloud — only selectable online.
 */
export class CloudEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly fetchImpl?: FetchLike) {}

  async embed(texts: string[], kind: 'query' | 'document' = 'document'): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const { embeddings } = await cloudPost<{ embeddings: number[][] }>('/embed', { texts, kind }, this.fetchImpl);
    if (embeddings.length !== texts.length) {
      throw new Error('Cloud embeddings returned an unexpected number of vectors');
    }
    return embeddings;
  }
}
