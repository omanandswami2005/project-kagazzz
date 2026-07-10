# document-scanner (V1 · Lane C)

Camera scanning: edge detection, perspective correction, crop, multi-page.
Item F-2 (🔴L).

- Spec: [02-document-vault-module.md](../../../../../docs/architecture/02-document-vault-module.md) (scan flows) + [04-image-engine-module.md](../../../../../docs/architecture/04-image-engine-module.md)
- Engine: [ADR-018](../../../../../docs/architecture/08-tech-stack-decisions.md#adr-018-document-scanner--google-ml-kit-via-play-services) — **Google ML Kit Document Scanner** (`@capacitor-mlkit/document-scanner`, native via Play Services). Supersedes ADR-016's jscanify + OpenCV.js.
- Depends on (interfaces only): `document-vault` (import pipeline)

## Design

ML Kit renders its **own** native full-screen scan UI (auto edge detection,
perspective correction, filters, ML page cleanup, multi-page → JPEG/PDF), so
this module has **no** camera page, corner-review UI, or geometry math — the
OpenCV-era `scan-geometry`/`scanner.types`/`ScannerEngine` seam was removed
(ADR-018). Android-only; the app keeps its zero-`INTERNET`/zero-`CAMERA`
manifest (Play Services hosts the UI + downloads the model out-of-process).

- `services/scanner.service.ts` — `isScanningSupported()` (Android) and
  `scanDocument()` → `ScannedDocument` (page image URIs + optional combined
  PDF). Cancellation resolves to `null`.

Scanned pages are imported through the vault's existing upload pipeline as
`IncomingFile`s (`source: 'scanner'`) — see `document-vault`
`services/upload-sources.ts` (`pickFromScanner`).
