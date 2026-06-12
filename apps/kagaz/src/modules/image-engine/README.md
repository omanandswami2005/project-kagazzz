# image-engine (V1 · Lane C)

On-device image operations. Items F-8 (format conversion — **done**), F-29
(filters — pending).

- Spec: [04-image-engine-module.md](../../../../../docs/architecture/04-image-engine-module.md)
- Tech choice: [ADR-016](../../../../../docs/architecture/08-tech-stack-decisions.md#adr-016-image-engine--document-scanner-offline-permissive-only)
- Depends on (interfaces only): `infrastructure/filesystem`

## F-8 — Format conversion (shipped)

Permissive, offline, **zero runtime dependencies** — native Canvas only.

- `services/format-detector.ts` — `detectFormat(blob)` / `detectFormatFromBytes(bytes)`:
  recognises JPEG/PNG/WebP/BMP/TIFF/GIF/HEIC from magic bytes (not the extension).
- `services/image-engine.service.ts` — `convertFormat(blob, target)` (JPEG/PNG/WebP
  via Canvas, encode/decode injected for testability) and `getImageInfo(blob)`.
- `types/image.types.ts` — `ImageFormat`, `ImageInfo`, `ImageEngineError`.

**HEIC:** no JS decoder is bundled (all are LGPL-3.0 — see ADR-016). HEIC is
decoded natively by the OS at camera capture (`@capacitor/camera` returns
JPEG); imported `.heic` files are stored as-is until a native decoder lands.

## Pending

- `workers/` — heavy ops (resize/filters) move off the main thread with F-29.
- F-2 document scanner (sibling `document-scanner` module) uses jscanify +
  OpenCV.js (lazy WASM, offline) per ADR-016.
