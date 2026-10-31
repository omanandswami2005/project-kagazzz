import type { IndexedChunk, SearchHit, VectorStore } from '../types';

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Brute-force cosine search over an in-process map. Enough for a few
 * thousand chunks; replace with a SQLite-backed store behind the same
 * {@link VectorStore} port when persistence or scale is needed.
 */
export class InMemoryVectorStore implements VectorStore {
  private readonly chunks = new Map<string, IndexedChunk>();

  upsert(chunks: IndexedChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
    return Promise.resolve();
  }

  removeDocument(documentId: string): Promise<void> {
    for (const [id, chunk] of this.chunks) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(id);
      }
    }
    return Promise.resolve();
  }

  search(queryVector: number[], topK: number): Promise<SearchHit[]> {
    const hits = [...this.chunks.values()]
      .map(({ vector, ...chunk }) => ({ chunk, score: cosine(queryVector, vector) }))
      .sort((x, y) => y.score - x.score)
      .slice(0, topK);
    return Promise.resolve(hits);
  }
}
