# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

**Kagaz** (a.k.a. Omni Docs; formerly "DocVault") — a privacy-first, offline-first document management and government-services app for India (React + Ionic + Capacitor + TypeScript, V1 offline vault → V2 cloud/sharing → V3 CSC services). The repo contains the full documentation/spec suite, workspace tooling (build/lint/test configs, Astro docs site), and the scaffolded `apps/kagaz/src/` module tree (P0-2) — directories + READMEs only; implementation files land with their checklist items.

**Read these first — they are binding, not optional:**
- `DEVELOPMENT-CHECKLIST.md` — **START HERE for any development work.** The living index of all work items (Phase 0 → V4), each cross-referenced to its spec/security/legal docs. Pick the next unblocked item, read its referenced docs before coding, and update the checklist when done (mark the box, append commit hash + date, log in its Commit Journal).
- `AGENT.md` — mandatory rules for AI agents: docs-as-code (every code change needs a matching doc update; architecture changes update docs FIRST), JSDoc on all public APIs, 80% test coverage, PR checklist.
- `CONTRIBUTING.md` — setup, architecture, protocol-based design, commit/branch conventions.
- `code/code-standards-and-quality.md` — compliance-focused code standards (audit-oriented).

## Git Discipline (mandatory)

- **`develop` is the integration branch** (exists since 2026-06-10): claim commits go on `develop`, feature branches are cut from `develop` (`feature/<item-id>-<short-name>`), and merges/PRs target `develop`. `main` only receives merges from `develop` at release points — never commit work or claims directly to `main`.
- **Every completed unit of work (feature, bugfix, doc change, refactor) gets its own Conventional Commit immediately** — never leave finished work uncommitted, never batch unrelated changes into one commit.
- **Stale-code sweep before closing every checklist item** (full checklist: `DEVELOPMENT-CHECKLIST.md` protocol step 4): after gates are green, delete what the item's own development made obsolete — dependencies added but no longer imported (lint won't catch them), exports used only by their own tests, placeholders the item replaced (incl. their tests/`.agent.ts`/`.skill.md`), orphaned CSS classes and i18n keys, READMEs describing the pre-item state. Commit as `chore(scope): <item> stale-code sweep`. Forward-looking code survives only with a comment naming the future item that uses it.
- **At session start and before ending a turn of work, run `git status` + `git diff`.** If uncommitted changes exist that this session didn't make, review the diffs, group them into logical commits with accurate messages, and commit them — then record them in the Commit Journal in `DEVELOPMENT-CHECKLIST.md`.
- Record the commit hash next to the checklist item it completes. Do not push unless the user asks.

## Commands & Workspace

**Always pnpm — never npm or yarn** (one root lockfile; `pnpm dlx` instead of `npx`; `pnpm exec` for local bins). Node ≥ 22.12, pnpm ≥ 10.

**Monorepo** (ADR-015): pnpm workspaces + Turborepo. `apps/kagaz` = the app (all `src/` paths in architecture docs mean `apps/kagaz/src/`), `apps/docs` = Starlight docs site, `packages/` = shared `@kagaz/*` packages (extraction rules in `packages/README.md`; depend via `workspace:*`). New workspace tech choices need an ADR in `08-tech-stack-decisions.md`.

```bash
pnpm dev                 # kagaz app dev server (via turbo filter)
pnpm build / test / type-check          # turbo runs across workspace (cached)
pnpm --filter kagaz vitest run path/to/file.test.ts   # single test file
pnpm --filter kagaz vitest -t "test name"             # single test by name
pnpm test:coverage       # gates: 80% lines/functions/statements, 75% branches
pnpm lint / lint:fix     # ESLint flat config at root, whole workspace
pnpm format              # Prettier
pnpm agent:lint          # agent-interface contract check (P0-7 stub: fails loudly)
pnpm docs:dev            # Astro Starlight docs site
pnpm --filter kagaz cap:sync / cap:open:android       # Capacitor (also build:capacitor)
```

Husky + lint-staged run ESLint/Prettier on commit. Commits follow **Conventional Commits** (`feat(scope): subject`, scopes = module names); branches `feature/…`, `bugfix/…`, `docs/…`, etc. PRs target `develop`.

**Parallel development**: work is split into lanes (A–F) with a claim-by-commit protocol on `DEVELOPMENT-CHECKLIST.md` — claim an item (🟨 line + push) before branching; never edit another lane's module; cross-module needs go through a Wave-1 contract PR (interface + mock + contract tests first). Full rules: `docs/guides/parallel-development.md`.

**Tech constraints to never "fix"**: `react-router-dom` stays at **v5** (`@ionic/react-router` peer requirement); `pdf-lib` is unmaintained-but-chosen (fallback: `@cantoo/pdf-lib`, see Dependency Version Policy in `08`); verify a package exists on npm before adding it (two past deps were hallucinated names); TypeScript stays at **6.0.x** (typescript-eslint max) with `pnpm type-check:native` (tsgo, the 10× Go compiler) as a fast advisory check — move `type-check` to TS 7 only when typescript-eslint supports it (policy in `08`).

## Architecture (full detail: `docs/architecture/01-system-architecture.md`)

- **Clean Architecture**: Presentation → Application → Domain (zero dependencies) → Infrastructure. Feature modules under `src/modules/` (document-vault, document-scanner, pdf-engine, image-engine, ai-assistant, search, settings, auth = V1; sharing, cloud-sync = V2; csc-services = V3), plus `src/core/`, `src/infrastructure/`, `src/design-system/`, `src/app/`.
- **Version dependency rule**: modules depend only on same-version-or-earlier. V1 never imports V2/V3.
- **Protocol-based design**: modules communicate via TypeScript interfaces only — never import another module's concrete implementation; shared code comes from `core/` or `infrastructure/`.
- Heavy ops (PDF, image, OCR, LLM inference) run in **Web Workers**. Strict TS — `any` and `console.log` are ESLint **errors**.
- **Logging**: structured pino only (`src/core/logging/`), never `console.log`. The idiom: `log('module-name').info({ event: 'vault.upload.success', opId, ...ctx })` — module child logger, dot-namespaced `event` first (same names as Action Registry ids), context object, no string interpolation. Audit-class events (consent, shares, destructive ops) go through `AuditLogDao.append()`, not pino. Three streams — colored dev console (pino-pretty), encrypted SQLite diagnostic ring buffer, hash-chained append-only audit log; central redaction denylist (keys, OCR text, Aadhaar/PAN, document content) applied in `redactRecord` because pino's `redact` is a no-op in browser builds. Consent/audit records are legal evidence. Full spec: `docs/architecture/14-observability-logging.md`.
- **Imports**: relative paths within a module; the `@/` alias (= `apps/kagaz/src/`) for anything cross-module (`import { log } from '@/core/logging'`). Workspace packages via `@kagaz/*`.
- Tests live in `__tests__/` folders beside the implementation.
- Tech choices are ADRs in `docs/architecture/08-tech-stack-decisions.md` — changing a technology requires updating the ADR.
- Offline-first is non-negotiable: V1 is 100% offline (no HTTP clients, analytics, or network permission); cloud is always an enhancement.

## Design System (`docs/design-system/` — read `README.md` there for the file order; the rules win over any screen that contradicts them)

- Never hardcode visual values — use tokens from `design-tokens.md`. Principles in `design-principles.md` govern any design debate (one primary action per screen; three density modes: Simple/Comfortable/Compact).
- Components: pick from `component-library.md`; behavior from `interaction-patterns.md`.
- **Agent interface contract** (`agent-interface.md`): every interactive element gets `data-agent-id` (+ `data-agent-state` when stateful); every action is registered once in the typed Action Registry (voice, AI tool calls, and E2E tests all use it). **Every new page ships three files**: `PageName.tsx`, `PageName.agent.ts`, `PageName.skill.md` (templates in `page-skill-template.md`) — `pnpm agent:lint` fails the build without them.

## Security, Legal & Compliance (this app handles Aadhaar/PAN-grade PII — treat violations as highest-severity defects)

- `docs/architecture/10-security-architecture.md` — threat model, SQLCipher DB encryption, platform-keystore-only key storage (never hardcode/log keys), AI metadata-only data boundary, user confirmation for destructive AI tool calls, V2 E2E sharing requirements, P0 checklist.
- `code/code-standards-and-quality.md` + `docs/indian-compliance-checklist.md` — DPDP Act 2023, IT Act, UIDAI/Aadhaar rules (**never store raw Aadhaar numbers or biometrics**), CERT-In, DigiLocker/CSC onboarding; consent logging requirements (user id, ISO 8601 timestamp, action, scope, request id; ~2-year retention); India-only data residency for any government-integration server data; retention/deletion rules. Error logs stay on-device in V1 — no remote crash reporting.
- `docs/compliance/` — DPIA and audit-evidence index. `docs/legal/` — privacy policy and T&C; code must never contradict them.
- Accessibility is a launch gate: WCAG 2.1 AA (`docs/architecture/11-accessibility-a11y.md`, per-component checklist in §7).
- Dependencies: permissive licenses only (MIT/Apache-2.0/BSD/ISC). **The project itself is proprietary (`UNLICENSED`, closed source)** — copyleft dependencies (GPL/AGPL/SSPL) are forbidden because they'd force source disclosure; the in-app "Open-source licenses" screen ships third-party attributions as legally required. Run `pnpm audit` before PRs.

## Performance Budgets (CI-enforced targets, `CONTRIBUTING.md`)

Total gzipped JS < 500KB (vendor < 200KB, app < 150KB, lazy module chunks < 100KB each); Lighthouse > 90; FCP < 2s; initial load < 3s on mid-range Android (API 24+ is the primary target).

## Documentation Conventions

Docs use a `> **Title** · Last Updated: date` header, TOC with anchor links, and Mermaid diagrams (green = V1, blue = V2, purple = V3). When editing a doc: update its "Last Updated" date, keep the TOC in sync, and keep cross-cutting facts consistent across `00`/`01`/`08`/`09` and the relevant module doc. Per `AGENT.md`, doc updates ship in the same PR as the code they describe.
