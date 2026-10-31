export type { EmbeddingProvider, IndexedChunk, SearchHit, VectorStore } from './types';
export { SemanticIndexService } from './services/semantic-index.service';
export { InMemoryVectorStore } from './stores/in-memory-vector.store';
export { OllamaEmbeddingProvider, type OllamaEmbeddingConfig } from './providers/ollama-embedding.provider';
export { CloudEmbeddingProvider } from './providers/cloud-embedding.provider';
export { getEmbeddingProvider } from './embedding-provider';
export { DocumentIndex, getDocumentIndex, type DocumentHit } from './document-index';
export { getEmbeddingBackend, type EmbeddingBackendId } from './embedding-provider';
