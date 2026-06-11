# document-vault (V1 · Lane A)

Core document management: upload, folders, tags, thumbnails, bulk ops, storage stats. Items F-1, F-9–12, F-24–26, F-30, F-32–34.

- Spec: [02-document-vault-module.md](../../../../../docs/architecture/02-document-vault-module.md)
- Structure: `components/`, `hooks/`, `services/`, `store/`, `types/`, `pages/`
- Depends on (interfaces only): `infrastructure/database`, `infrastructure/filesystem`, `search`

## Status

**F-1 Document Upload — done.** Camera / gallery (`@capacitor/camera`) and
file picker (DOM input) feed the upload pipeline in
`services/upload.service.ts`: validate (extension allow-list, 100 MB cap,
magic-byte corruption check, free-space guard) → optional HEIC→JPEG
convert → SHA-256 hash → `FileStorage.write(documents/{uuid}.{ext})` →
`DocumentDao.create`. Per-file failures never abort the batch. The
`vault.uploadDocument` action (`vault.actions.ts`) is the page's primary
action; `pages/VaultHomePage.*` ships the full agent trio.

### Deviations from the spec (deliberate, tracked)

- **HEIC→JPEG conversion** is an injectable `HeicConverter` protocol, not
  bundled: every wasm HEIC decoder is ~700 KB+ gzipped and blows the
  bundle budget. HEIC files are stored as-is (a supported `FileType`);
  the real converter lands with **F-8** (image-engine, Web Worker).
- **`useDocuments` uses the Zustand store, not TanStack Query** — the app
  shell has no `QueryClientProvider` yet; revisit with F-9/F-11.
- **Thumbnails (F-24) and auto-OCR (F-20)** stages are absent from the
  pipeline by checklist design; `UploadStage` already reserves their slots.
