# infrastructure/database

Encrypted SQLite layer (P0-4). Spec: [09-database-design.md](../../../../../docs/architecture/09-database-design.md) · `[SEC]` [10-security-architecture.md](../../../../../docs/architecture/10-security-architecture.md) §3.2/§3.4.

| File | Purpose |
|---|---|
| `connection.ts` | `DbConnection` protocol — everything depends on this, never on the plugin |
| `encryption-key.provider.ts` | 256-bit SQLCipher key in platform secure storage (`db_encryption_key`); never logged |
| `database.service.ts` | Opens `kagaz.db` encrypted, adapts the plugin, runs migrations |
| `migration-runner.ts` | Versioned, transactional, immutable migrations (`_migrations` table) |
| `migrations/` | `001` V1 schema + indexes, `002` FTS5 + sync triggers. V2/V3 tables ship as new migrations with their versions |
| `dao/` | Typed DAOs (documents, folders, tags, operations, AI chat, settings) — all SQL lives here |

Rules: no `console.*` (callers wire logging via `onApplied`); rows map snake_case → camelCase via strict coercers that throw on schema drift; soft delete + optimistic `version` bump on documents. Repository implementations (`repositories/`) land with the Wave-1 vault contracts, not here.
