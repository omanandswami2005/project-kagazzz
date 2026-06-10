# app/

App shell (P0-10): `routes/` (route tree, guards, `lazy-imports.ts`), `providers/` (Theme/I18n/Database/AI), `App.tsx`.

Rules:

- All module pages load via `React.lazy()` route-level imports — V2/V3 chunks must never load in a V1-only session.
- Error boundaries log locally only (no remote crash reporting in V1) per [10-security-architecture.md](../../../../docs/architecture/10-security-architecture.md).
- Spec: [01-system-architecture.md](../../../../docs/architecture/01-system-architecture.md) §Module Structure + §Build.
