# image-engine (V1 · Lane C)

Image operations: compress, format conversion (JPG/PNG/WEBP, HEIC in), crop, enhance. Items F-8, F-29.

- Spec: [04-image-engine-module.md](../../../../../docs/architecture/04-image-engine-module.md)
- Structure: `services/`, `workers/` (heavy ops), `types/`
- Depends on (interfaces only): `infrastructure/filesystem`
