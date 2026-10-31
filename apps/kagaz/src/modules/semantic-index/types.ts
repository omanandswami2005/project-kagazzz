/**
 * Ports for semantic search. Callers (the AI assistant, the search bar)
 * depend only on these — never on Ollama, a hosted API, or a concrete store —
 * so either side can be swapped by writing one new adapter.
 */

/** Turns text into fixed-length vectors. One adapter per backend (Ollama, hosted API, on-device). */
export interface EmbeddingProvider {
  /** Embeds each text; result order matches input order. */
  embed(texts: string[]): Promise<number[][]>;
}

/** A stored, searchable piece of a document. */
export interface IndexedChunk {
  /** Unique within the store, e.g. `${documentId}:${chunkIndex}`. */
  id: string;
  documentId: string;
  text: string;
  vector: number[];
}

export interface SearchHit {
  chunk: Omit<IndexedChunk, 'vector'>;
  /** Cosine similarity, -1..1 (higher is closer). */
  score: number;
}

/** Persists vectors and finds the nearest ones. */
export interface VectorStore {
  upsert(chunks: IndexedChunk[]): Promise<void>;
  /** Removes every chunk belonging to a document (re-index or delete). */
  removeDocument(documentId: string): Promise<void>;
  search(queryVector: number[], topK: number): Promise<SearchHit[]>;
}
