import type { EmbeddingProvider, SearchHit, VectorStore } from '../types';
import { chunkText } from './chunk-text';

/**
 * Indexes document text and answers "which passages are closest to this
 * query". Depends only on the {@link EmbeddingProvider} and
 * {@link VectorStore} ports, so it is backend-agnostic and unit-testable
 * with fakes.
 */
export class SemanticIndexService {
  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly store: VectorStore
  ) {}

  /** (Re)indexes a document: old chunks are dropped first so edits never leave stale vectors. */
  async indexDocument(documentId: string, text: string): Promise<number> {
    await this.store.removeDocument(documentId);
    const pieces = chunkText(text);
    if (pieces.length === 0) {
      return 0;
    }
    const vectors = await this.embeddings.embed(pieces);
    await this.store.upsert(
      pieces.map((piece, i) => ({
        id: `${documentId}:${i}`,
        documentId,
        text: piece,
        vector: vectors[i],
      }))
    );
    return pieces.length;
  }

  removeDocument(documentId: string): Promise<void> {
    return this.store.removeDocument(documentId);
  }

  async search(query: string, topK = 5): Promise<SearchHit[]> {
    const [queryVector] = await this.embeddings.embed([query], 'query');
    return this.store.search(queryVector, topK);
  }
}
