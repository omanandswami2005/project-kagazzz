# infrastructure/

Concrete implementations of domain interfaces: `database/` (SQLite + SQLCipher, migrations, DAOs, repositories — P0-4), `filesystem/` (native + web fallback — P0-5), `capacitor/` (plugin wrappers). `ai/` is an empty P0-2 scaffold — the on-device LLM engine (LiteRT-LM, F-13) lives in `modules/ai-assistant/services/` instead, since it has no other module consumer; OCR (ML Kit, F-20) is a `capacitor/` plugin wrapper, not a separate engine here.

Rules:

- Modules depend on the interfaces these implement, never the other way around (Clean Architecture: Infrastructure is the outermost ring).
- Security constraints in [10-security-architecture.md](../../../../docs/architecture/10-security-architecture.md) §3 (encryption params, key storage, temp cleanup) are binding here.
- Spec: [01-system-architecture.md](../../../../docs/architecture/01-system-architecture.md) §Infrastructure Layer, [09-database-design.md](../../../../docs/architecture/09-database-design.md).
