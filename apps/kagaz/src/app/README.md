# app/

App shell (P0-10): `routes/` (route tree, `lazy-imports.ts`), `providers/` (Theme/I18n/Database/AI + combined `AppProviders`), `ErrorBoundary`, `App.tsx`. Since F-1, `/` redirects to the document-vault module's `/vault` page — the shell owns no pages of its own.

Bootstrap order (binding): ErrorBoundary → ThemeProvider (token attributes on `<html>`) → I18nProvider (`initI18n`, `<html lang/dir>`) → DatabaseProvider (open SQLCipher DB → migrations → `DiagnosticSink.pruneOnLaunch()` → `setDiagnosticSink` → `cleanupTempFiles`) → AIProvider (F-13 mount point).

Rules:

- All module pages load via `React.lazy()` route-level imports in `lazy-imports.ts` — V2/V3 chunks must never load in a V1 session.
- Error boundaries log `fatal` locally only (no remote crash reporting in V1, [SEC]).
- `index.html` carries the §3.5 offline CSP — connect-src stays `'self'` until V2 ships its consent + E2E requirements.
- Route guards (`AuthGuard`, `VersionGuard`) land with F-16.
- Spec: [01-system-architecture.md](../../../../docs/architecture/01-system-architecture.md) §Module Structure + §Build.
