/**
 * Semantic search over the user's documents, end to end:
 *
 *   image / scanned PDF ──(Gemma vision)──► text ──(EmbeddingGemma, or Vertex when online)──► vectors
 *   question ──(same embedding model)──► nearest passages ──► the assistant answers from them.
 *
 * [SEC] DEMO-ONLY DEVIATION from the metadata-only rule (10-security-architecture.md §5):
 * the returned passages are slices of document *content* that go to the model — and,
 * when online, to Google Cloud. It was relaxed deliberately for the hackathon; before any
 * release it needs consent, a DPIA update and per-document opt-in. Locked documents are
 * still never read, indexed or returned (the biometric lock is a user-facing guarantee).
 */
import type { DocumentEntity } from '@/infrastructure/database/types';
import { getDocumentIndex, type EmbeddingBackendId } from '@/modules/semantic-index';

export interface SemanticSearchResult {
  results: { documentId: string; name: string; score: number; passage: string }[];
  /** Which embedding model family answered: EmbeddingGemma locally, Vertex AI online. */
  backend: EmbeddingBackendId;
  /** Documents (re)embedded during this call. */
  indexed: number;
  /** Documents read by the vision model during this call (they had no stored text). */
  transcribed: number;
  /** Documents still without text because the per-call transcription budget ran out. */
  unreadRemaining: number;
}

export interface DocumentSearchDeps {
  listDocuments: () => Promise<DocumentEntity[]>;
  /** Reads a document's text — vision OCR for images and scanned PDFs; stores it. Null if it cannot be read. */
  extractText: (document: DocumentEntity) => Promise<string | null>;
  /** Bounds how long one search can spend reading documents. */
  maxTranscribe?: number;
}

const PASSAGE_CHARS = 500;

export async function semanticSearchDocuments(
  deps: DocumentSearchDeps,
  query: string,
  limit: number
): Promise<SemanticSearchResult> {
  const active = getDocumentIndex();
  if (!active) {
    throw new Error(
      'Semantic search needs the search model. Ask the user to download it in Settings → AI Assistant → Search model (about 330 MB, one time).'
    );
  }
  const documents = (await deps.listDocuments()).filter((d) => !d.isLocked);
  const budget = deps.maxTranscribe ?? 6;

  const texts: { id: string; text: string }[] = [];
  let transcribed = 0;
  let unreadRemaining = 0;
  for (const doc of documents) {
    if (doc.ocrText?.trim()) {
      texts.push({ id: doc.id, text: doc.ocrText });
    } else if (transcribed < budget) {
      transcribed++;
      const text = await deps.extractText(doc);
      if (text?.trim()) {
        texts.push({ id: doc.id, text });
      }
    } else {
      unreadRemaining++;
    }
  }

  const indexed = await active.index.sync(texts);
  const hits = await active.index.search(query, limit);
  const byId = new Map(documents.map((d) => [d.id, d]));
  return {
    results: hits.flatMap((hit) => {
      const doc = byId.get(hit.documentId);
      return doc
        ? [{ documentId: doc.id, name: doc.name, score: Math.round(hit.score * 1000) / 1000, passage: hit.passage.slice(0, PASSAGE_CHARS) }]
        : [];
    }),
    backend: active.backend,
    indexed,
    transcribed,
    unreadRemaining,
  };
}
