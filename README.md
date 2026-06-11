# Kagaz (कागज़)

**Privacy-first, offline-first document management for India.** Scan, store, organize, and manage government and personal documents (Aadhaar, PAN, marksheets, certificates) in an encrypted on-device vault — with government-service workflows arriving in later versions.

> Proprietary software (`UNLICENSED`, closed source). Built with React + Ionic + Capacitor + TypeScript.

## Release roadmap

| Version | Theme | Data leaves the device? |
|---|---|---|
| **V1** (current) | Local-first document vault: upload, scan, PDF tools, OCR, on-device AI assistant | **Never** — no network permission, no analytics |
| V2 | Cloud backup & E2E-encrypted sharing (opt-in) | Only with explicit consent |
| V3 | Consumer CSC / government-service facilitation | Compliance-gated (DPDP, UIDAI, CERT-In) |

**Status:** Phase 0 (foundation) complete · F-1 Document Upload shipped · remaining V1 features in progress — live status in [DEVELOPMENT-CHECKLIST.md](DEVELOPMENT-CHECKLIST.md).

## Repository layout

pnpm workspaces + Turborepo monorepo:

```
apps/kagaz/        The app (React + Ionic + Capacitor; android/ + ios/ platforms)
apps/docs/         Astro Starlight documentation site
packages/          Shared @kagaz/* packages (design-tokens, ui, agent-kit)
docs/              Architecture, design-system, compliance, legal & business specs
code/              Code standards (compliance/audit-oriented)
scripts/           Workspace tooling (agent:lint, agent:sitemap, bundle budgets)
```

## Quickstart

Requires **Node ≥ 22.12** and **pnpm ≥ 10** (never npm/yarn).

```bash
pnpm install
pnpm dev                 # app dev server
pnpm test                # full test suite (coverage gates: 80/75)
pnpm lint && pnpm type-check
pnpm build               # production web build
```

### Android (debug APK)

```powershell
pnpm --filter kagaz build:capacitor      # web build + cap sync
cd apps/kagaz/android; .\gradlew.bat assembleDebug
# → apps/kagaz/android/app/build/outputs/apk/debug/app-debug.apk
```

## Read this before contributing

1. [DEVELOPMENT-CHECKLIST.md](DEVELOPMENT-CHECKLIST.md) — **start here**: the living index of all work items, claim protocol, Definition of Done (incl. stale-code sweep and device verification).
2. [CONTRIBUTING.md](CONTRIBUTING.md) — setup, architecture rules, commit/branch conventions, performance budgets.
3. [AGENT.md](AGENT.md) — mandatory rules for AI agents (docs-as-code, JSDoc, coverage).
4. [docs/architecture/](docs/architecture/) — system architecture, database, security, observability, a11y, i18n.
5. [docs/design-system/](docs/design-system/) — tokens, components, and the agent-interface contract (every page ships `.agent.ts` + `.skill.md`).

Key engineering rules: Clean Architecture with protocol-based module boundaries · V1 modules never import V2/V3 · design tokens only (no hardcoded visuals) · structured pino logging (no `console.log`) · git flow through `develop` (`main` = release merges only).

## Security & compliance

This app handles Aadhaar/PAN-grade PII. SQLCipher-encrypted database with platform-keystore keys, no network permission in V1 release builds, DPDP Act 2023 / UIDAI / CERT-In obligations tracked in [docs/indian-compliance-checklist.md](docs/indian-compliance-checklist.md) and [docs/compliance/](docs/compliance/). Treat violations as highest-severity defects.

## License

Proprietary — `UNLICENSED`. All rights reserved. Third-party dependencies are permissive-licensed (MIT/Apache-2.0/BSD/ISC) and attributed in-app.
