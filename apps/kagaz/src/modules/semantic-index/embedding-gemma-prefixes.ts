/**
 * EmbeddingGemma is trained with task prefixes: a query and a document are
 * embedded differently. Callers pass plain text; every EmbeddingGemma adapter
 * (Ollama, on-device LiteRT) adds the prefix through these.
 */
export const EMBEDDING_GEMMA_QUERY_PREFIX = 'task: search result | query: ';
export const EMBEDDING_GEMMA_DOCUMENT_PREFIX = 'title: none | text: ';

/** Applies the right prefix for the kind of text being embedded. */
export function withEmbeddingGemmaPrefix(text: string, kind: 'query' | 'document'): string {
  return (kind === 'query' ? EMBEDDING_GEMMA_QUERY_PREFIX : EMBEDDING_GEMMA_DOCUMENT_PREFIX) + text;
}
