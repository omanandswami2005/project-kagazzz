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
- `services/pdf-compress-ops.ts` — `compressPdfImpl` (F-5) on
  **@quicktoolsone/pdf-compress** (quality → preset). Hands the compressor a
  tight buffer (handles subarray views).
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

### Not done yet

- Device verification of the worker round-trip + the eventual UI (protocol
  step 5). F-3/4/5 stay open until then.
- F-6 (PDF→image), F-7 (image→PDF), F-21/22 (encrypt/decrypt), F-28, and the
  rest of the spec API are later items.
