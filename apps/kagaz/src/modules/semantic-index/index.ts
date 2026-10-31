export type { EmbeddingProvider, IndexedChunk, SearchHit, VectorStore } from './types';
export { SemanticIndexService } from './services/semantic-index.service';
export { InMemoryVectorStore } from './stores/in-memory-vector.store';
export { OllamaEmbeddingProvider, type OllamaEmbeddingConfig } from './providers/ollama-embedding.provider';
