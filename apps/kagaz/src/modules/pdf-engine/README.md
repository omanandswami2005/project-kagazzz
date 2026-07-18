# pdf-engine (V1 · Lane B)

PDF operations: merge, split, compress, convert, encrypt/decrypt, render, form filling. Items F-3–7, F-21–22, F-28.

- Spec: [03-pdf-engine-module.md](../../../../../docs/architecture/03-pdf-engine-module.md)
- Structure: `services/` (pdf-lib / pdfjs-dist wrappers), `workers/` (all heavy ops run here), `types/`
- `[SEC]`: never log or store PDF passwords (F-22). All ops in Web Workers (`?worker`).

## Implemented — F-3 / F-4 / F-5 (pending device verification)

Real, worker-backed. No mock in the shipped path.

- `services/pdf-engine.service.ts` — `PdfEngineServiceImpl` (the `PdfEngineService`
  interface for merge/split/compress + `initialize`/`destroy`). Spawns the two
  workers, correlates requests by id, **clones buffers before transfer** (the
  caller's bytes are never detached), relays worker logs to the main sink, and
  maps worker errors back to `PdfEngineException`.
- `services/pdf-ops.ts` — `mergePdfsImpl` (F-3), `splitPdfImpl` (F-4),
  `loadAndValidatePdf`, on **pdf-lib**. Progress callbacks per file/range.
- `services/pdf-compress-ops.ts` — `compressPdfImpl` (F-5) by **rasterise-and-
  rebuild**: render each page to a JPEG (pdfjs) at a quality-dependent DPI, then
  rebuild a PDF from those images (pdf-lib). Chosen deliberately — the better
  text-preserving compressors are either AGPL (MuPDF, Ghostscript — forbidden)
  or CDN + WASM-eval dependent (`@quicktoolsone/pdf-compress`, which fails on
  the zero-network app). MIT, fully offline, no WASM/CDN/CSP change; lossy
  (text→raster), fine for the scans/photos compression mostly runs on. Runs on
  the main thread (pdfjs + canvas). MuPDF-commercial is the lossless upgrade
  path. See ADR-017 / the media-library rule in CLAUDE.md.
- `workers/pdf-manipulation.worker.ts`, `workers/pdf-compress.worker.ts` — thin
  shells that run the ops off the main thread and post `result`/`progress`/`error`.
- `types/pdf-engine.types.ts` — `PdfEngineService`, `PageRange`,
  `CompressionLevel`, `ProgressEvent`, `PdfErrorCode`, `PdfEngineException`.

### Testing

- `types/__contract__/pdf-engine.contract.ts` — the reusable behavioural
  contract (Wave-1). Runs against the **real `PdfEngineServiceImpl`** via
  `@vitest/web-worker` (`clone: 'ponyfill'`, since the service transfers
  ArrayBuffers and an in-realm transfer would detach them). Merge + split +
  every validation/error path execute the real workers + real pdf-lib.
- `services/__tests__/pdf-ops.test.ts` — unit tests for the real ops (real
  pdf-lib fixtures; the WASM compressor is mocked here for speed).
- **Compress byte-reduction is device-verified only.** The compressor
  rasterises pages to images, which needs a canvas jsdom doesn't have, so that
  one assertion is `skipIf(no canvas)` — it runs on a real device, not in CI.

## Implemented — F-6 / F-7 / F-21 / F-22 / F-28 (pending device verification)

- `services/pdf-ops.ts` — `imagesToPdfImpl` (F-7, pdf-lib embedJpg/embedPng).
- `services/pdf-security-ops.ts` — `encryptPdfImpl` / `decryptPdfImpl` (F-21/F-22,
  @pdfsmaller AES-256). **[SEC]** the password is used for the op only — never
  logged, never persisted. Wrong password → `WRONG_PASSWORD`.
- `services/pdf-forms-ops.ts` — `getFormFieldsImpl` / `fillFormImpl` (F-28,
  pdf-lib forms; fill flattens the result).
- `services/pdf-render-ops.ts` — `pdfToImagesImpl` (F-6, pdfjs → image blobs).
  Runs on the **main thread** (canvas; the proven thumbnail path), not a worker.
- F-7/F-21/F-22/F-28 route through `pdf-manipulation.worker` (switch dispatch);
  the service gained the six methods + a `dispatch` helper. `pdfErrorInfoOf`
  duck-types error codes across the worker boundary.

## PDF Tools UI (the hub that drives all of the above)

- `pages/PdfToolsPage.tsx` (`/pdf-tools`, reached from the vault header) — a grid
  of the eight operations + `pages/PdfToolsPage.agent.ts` / `.skill.md`.
- `components/PdfOpSheet.tsx` — one adaptive modal per op: pick vault document(s)
  (`components/PdfDocPicker.tsx`), set params, run with progress, save to vault.
- `hooks/usePdfEngine.ts` — one `PdfEngineServiceImpl` per screen; reads input
  bytes from FileStorage, runs ops, ingests results via `useUpload.ingestFiles`.
- `services/parse-ranges.ts` — "1-3, 5" → 0-based `PageRange[]` (pure, tested).
- `pdf-tools.actions.ts` — `tools.openPdfTools` (surfaced on the vault home too).

### Not done yet

- **Device verification** of all eight ops end-to-end (protocol step 5) — the
  worker round-trip, the canvas/pdfjs paths (compress byte-reduction, F-6
  render), and the PDF Tools UI. Every lane-B item stays open until then.
- The rest of the spec API (create, watermark/stamp, metadata, OCR) — later items.
