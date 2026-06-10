# infrastructure/filesystem

Platform-agnostic file storage (P0-5). Spec: [01-system-architecture.md](../../../../../docs/architecture/01-system-architecture.md) §Infrastructure · `[SEC]` [10-security-architecture.md](../../../../../docs/architecture/10-security-architecture.md) §3.3.

| File | Purpose |
|---|---|
| `file-storage.ts` | `FileStorage` protocol + `STORAGE_DIRS` layout (documents/, thumbnails/, temp/, backups/) |
| `capacitor-fs.ts` | Native impl over `@capacitor/filesystem` (sandboxed `Directory.Data`) |
| `web-fs.ts` | PWA fallback over IndexedDB (Dexie) |
| `factory.ts` | `createFileStorage()` platform selection |
| `temp-cleanup.ts` | `cleanupTempFiles()` — **must run on every app launch** (§3.3) |
| `base64.ts` | Chunked Uint8Array↔base64 for the Capacitor data format |

Rules: paths are app-relative only (no absolute-path leakage); modules depend on the `FileStorage` interface, never an implementation. `thumbnail.service.ts` lands with F-24, not here.
