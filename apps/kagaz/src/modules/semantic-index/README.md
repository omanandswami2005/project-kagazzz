# semantic-index (V1.5 · hackathon spike)

Embeds document text and finds the nearest passages by meaning.

- `types.ts` — the two ports: `EmbeddingProvider` (text → vectors) and `VectorStore` (persist + nearest-neighbour). Everything else depends only on these.
- `providers/` — adapters for `EmbeddingProvider`. Today: Ollama (`embeddinggemma`). To use a hosted API instead, add one file implementing the port.
- `stores/` — adapters for `VectorStore`. Today: in-memory brute-force cosine. A SQLite-backed store would implement the same port.
- `services/` — `SemanticIndexService` (chunk → embed → store, and query).

⚠️ **Spike status:** not yet wired into the assistant or search UI. Indexing OCR text and putting retrieved passages into prompts crosses the metadata-only `[SEC]` boundary in `10-security-architecture.md` §5 — that doc, the DPIA and the privacy policy must be updated before this ships outside a demo.
