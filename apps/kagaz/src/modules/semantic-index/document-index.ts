/**
 * Document-level semantic search on top of the chunk-level {@link SemanticIndexService}:
 * remembers which documents' text is already embedded (re-embedding only what
 * changed) and collapses chunk hits to the best passage per document.
 *
 * One index per embedding backend — vectors from different models are not
 * comparable (EmbeddingGemma offline, Vertex text-embedding-005 online).
 */
import { getEmbeddingBackend, type EmbeddingBackendId } from './embedding-provider';
import { SemanticIndexService } from './services/semantic-index.service';
import { InMemoryVectorStore } from './stores/in-memory-vector.store';

export interface DocumentHit {
  documentId: string;
  /** Cosine similarity of the best-matching passage. */
  score: number;
  /** The best-matching passage (a slice of the document's text). */
  passage: string;
}

/** FNV-1a — enough to notice that a document's text changed. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return `${text.length}:${(h >>> 0).toString(16)}`;
}

export class DocumentIndex {
  private readonly fingerprints = new Map<string, string>();

  constructor(private readonly service: SemanticIndexService) {}

  /** Embeds documents that are new or whose text changed; returns how many were (re)indexed. */
  async sync(documents: { id: string; text: string }[]): Promise<number> {
    let indexed = 0;
    for (const { id, text } of documents) {
      const print = fingerprint(text);
      if (this.fingerprints.get(id) === print) {
        continue;
      }
      await this.service.indexDocument(id, text);
      this.fingerprints.set(id, print);
      indexed++;
    }
    return indexed;
  }

  /** Best passage per document, best document first. */
  async search(query: string, limit: number): Promise<DocumentHit[]> {
    // Ask for extra chunks: several can come from the same document.
    const hits = await this.service.search(query, Math.max(limit * 4, 8));
    const best = new Map<string, DocumentHit>();
    for (const { chunk, score } of hits) {
      if (!best.has(chunk.documentId)) {
        best.set(chunk.documentId, { documentId: chunk.documentId, score, passage: chunk.text });
      }
    }
    return [...best.values()].slice(0, limit);
  }
}

const indexes = new Map<EmbeddingBackendId, DocumentIndex>();

/** The index for the current mode's embedding backend, or null when this build has none. */
export function getDocumentIndex(): { backend: EmbeddingBackendId; index: DocumentIndex } | null {
  const backend = getEmbeddingBackend();
  if (!backend) {
    return null;
  }
  let index = indexes.get(backend.id);
  if (!index) {
    index = new DocumentIndex(new SemanticIndexService(backend.provider, new InMemoryVectorStore()));
    indexes.set(backend.id, index);
  }
  return { backend: backend.id, index };
}
