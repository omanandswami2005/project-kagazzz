# search (V1 · Lane A)

Full-text search (SQLite FTS5), filters, sort, OCR text extraction. Items F-11, F-12, F-20.

- Spec: [02-document-vault-module.md](../../../../../docs/architecture/02-document-vault-module.md) §Search + [09-database-design.md](../../../../../docs/architecture/09-database-design.md) (FTS5)
- Structure: `services/`, `hooks/`, `components/`
- `[SEC]`: OCR text is sensitive — encrypted DB only (`documents.ocr_text`, indexed by FTS). OCR runs natively via **bundled ML Kit** ([ADR-019](../../../../../docs/architecture/08-tech-stack-decisions.md#adr-019-ocr--bundled-native-ml-kit-text-recognition)); the service/hook live in `image-engine` (`ocr.service`) + `document-vault` (`useDocumentOcr`).
