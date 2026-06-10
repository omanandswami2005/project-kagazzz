# search (V1 · Lane A)

Full-text search (SQLite FTS5), filters, sort, OCR text extraction. Items F-11, F-12, F-20.

- Spec: [02-document-vault-module.md](../../../../../docs/architecture/02-document-vault-module.md) §Search + [09-database-design.md](../../../../../docs/architecture/09-database-design.md) (FTS5)
- Structure: `services/`, `hooks/`, `components/`
- `[SEC]`: OCR text is sensitive — encrypted DB only. OCR runs in a worker (tesseract.js).
