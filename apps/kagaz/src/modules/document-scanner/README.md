# document-scanner (V1 · Lane C)

Camera scanning: edge detection, perspective correction, crop. Item F-2
(🔴L, in progress).

- Spec: [02-document-vault-module.md](../../../../../docs/architecture/02-document-vault-module.md) (scan flows) + [04-image-engine-module.md](../../../../../docs/architecture/04-image-engine-module.md)
- Engine: [ADR-016](../../../../../docs/architecture/08-tech-stack-decisions.md#adr-016-image-engine--document-scanner-offline-permissive-only) — jscanify + OpenCV.js (lazy WASM, offline), **not** ML Kit
- Depends on (interfaces only): `infrastructure/capacitor`, `image-engine`, `document-vault`

## Done — geometry + orchestration core

Pure, library-agnostic, fully unit-tested (no WASM in jsdom):

- `types/scanner.types.ts` — `Point`, `Quad` (TL/TR/BR/BL), `ScanResult`, `ScanOptions`.
- `services/scan-geometry.ts` — `orderCorners` (unordered points → canonical
  clockwise quad), `quadOutputSize` (de-skew output dims), `isValidQuad`
  (convex + min-area), `quadArea`, `distance`.
- `services/scanner.service.ts` — `scanDocument(engine, opts)` (auto) and
  `applyCorners(engine, points, opts)` (after the user drags corner handles),
  both over a pluggable `ScannerEngine`.

## Pending (Slice 2)

- OpenCV.js/jscanify `ScannerEngine` implementation (lazy-loaded, self-hosted).
- Camera capture page + live edge highlight + draggable-corner review
  (`pages/`, `components/`), `.agent.ts`/`.skill.md`, i18n, vault save.
- Device verification (camera, real CV) — the one part green unit tests can't prove.
