# pdf-engine (V1 · Lane B)

PDF operations: merge, split, compress, convert, encrypt/decrypt, render, form filling. Items F-3–7, F-21–22, F-28.

- Spec: [03-pdf-engine-module.md](../../../../../docs/architecture/03-pdf-engine-module.md)
- Structure: `services/` (pdf-lib / pdfjs-dist wrappers), `workers/` (all heavy ops run here), `types/`
- `[SEC]`: never log or store PDF passwords (F-22). All ops in Web Workers (`?worker`).
