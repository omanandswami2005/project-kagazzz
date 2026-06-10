# infrastructure/

Concrete implementations of domain interfaces: `database/` (SQLite + SQLCipher, migrations, DAOs, repositories — P0-4), `filesystem/` (native + web fallback — P0-5), `capacitor/` (plugin wrappers), `ai/` (WebLLM/Tesseract engine init).

Rules:

- Modules depend on the interfaces these implement, never the other way around (Clean Architecture: Infrastructure is the outermost ring).
- Security constraints in [10-security-architecture.md](../../../../docs/architecture/10-security-architecture.md) §3 (encryption params, key storage, temp cleanup) are binding here.
- Spec: [01-system-architecture.md](../../../../docs/architecture/01-system-architecture.md) §Infrastructure Layer, [09-database-design.md](../../../../docs/architecture/09-database-design.md).
