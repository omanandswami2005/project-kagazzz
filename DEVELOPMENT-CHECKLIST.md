# Kagaz — Development Checklist (Living Index)

> **The single source of truth for development progress.** Any agent or human starting work MUST read this file first, pick the next unblocked item, and update this file when done.
> Feature numbers (F-1 … F-107) come from [docs/business-model/feature-priorities.md](docs/business-model/feature-priorities.md) — that file owns priority/effort/impact; this file owns *status*.
>
> Last updated: 2026-06-10 (logging spec, app-portfolio doc, dependency overhaul)

---

## How to use this file (protocol for agents)

0. **Claim before working** (parallel development): commit a claim on the item line — `🟨 claimed — <branch> · <agent/dev> · <date>` — and push before branching. First pushed claim wins. **Branch name is derived from the item, deterministically**: `feature/<item-id>-<short-kebab-name>` — e.g. F-3 → `feature/f3-pdf-merge`, P0-7 → `feature/p07-agent-interface`, G1-3 → `chore/g1-3-a11y-audit` (use `bugfix/`/`chore/`/`docs/` prefixes per CONTRIBUTING.md when the item isn't a feature). One item = one branch; the item id in the branch makes claims, PRs, and commits mechanically traceable. Full protocol + lane ownership: [docs/guides/parallel-development.md](docs/guides/parallel-development.md).
1. **Before working**: find the item here; read every doc it references **before writing code**.
2. **While working**: follow the Definition of Done (below) — it applies to *every* item and is not repeated per line.
3. **After working**: mark the checkbox, append `✅ <commit-hash> (YYYY-MM-DD)` to the item, and update the "Last updated" date above. If you only partially finished, append `🟨 in progress — <what remains>`.
4. **Commits**: every completed item ends in at least one Conventional Commit (`feat(scope): …`, see [CONTRIBUTING.md](CONTRIBUTING.md)). Record the hash here. If you find uncommitted changes you didn't make, review the diff, group them into logical commits, commit them, and log them under [Commit Journal](#commit-journal).
5. **Gate tags** on items mean extra mandatory reading:
   - `[SEC]` → [docs/architecture/10-security-architecture.md](docs/architecture/10-security-architecture.md)
   - `[LEGAL]` → [docs/indian-compliance-checklist.md](docs/indian-compliance-checklist.md) + [code/code-standards-and-quality.md](code/code-standards-and-quality.md)
   - `[CONSENT]` → [docs/ux/consent-screens.md](docs/ux/consent-screens.md) (exact UI copy) + consent-log format in [code/code-standards-and-quality.md](code/code-standards-and-quality.md)
   - `[DPIA]` → update [docs/compliance/dpia.md](docs/compliance/dpia.md) and evidence in [docs/compliance/index.md](docs/compliance/index.md)
   - `[A11Y]` → [docs/architecture/11-accessibility-a11y.md](docs/architecture/11-accessibility-a11y.md) §7 checklist
   - `[I18N]` → [docs/architecture/12-i18n-multilingual.md](docs/architecture/12-i18n-multilingual.md)
   - `[PERF]` → budgets in [CONTRIBUTING.md](CONTRIBUTING.md) + [docs/architecture/01-system-architecture.md](docs/architecture/01-system-architecture.md)

### Definition of Done (every item, per [AGENT.md](AGENT.md))

- [ ] applies to each item implicitly: strict TS (no `any`) · JSDoc on public APIs · tests in `__tests__/` (≥80% lines/functions, ≥75% branches) · module README updated · architecture docs updated if structure changed · design tokens only (no hardcoded visuals, [docs/design-system/design-tokens.md](docs/design-system/design-tokens.md)) · every page ships `PageName.agent.ts` + `PageName.skill.md` ([docs/design-system/page-skill-template.md](docs/design-system/page-skill-template.md)) · `data-agent-id` on interactive elements ([docs/design-system/agent-interface.md](docs/design-system/agent-interface.md)) · a11y per-component checklist passed · `pnpm lint && pnpm type-check && pnpm test` green · Conventional Commit recorded here.

---

## Phase 0 — Foundation & Scaffolding (blocks everything)

> Refs: [docs/architecture/01-system-architecture.md](docs/architecture/01-system-architecture.md) (module structure), [CONTRIBUTING.md](CONTRIBUTING.md) (setup), [docs/architecture/08-tech-stack-decisions.md](docs/architecture/08-tech-stack-decisions.md) (ADRs — do not deviate without updating)

- [ ] P0-1 Create `tsconfig.json` (strict flags per CONTRIBUTING.md) and `vite.config.ts` (workers, code-splitting per 01 §Build) 🟨 claimed — feature/p01-tsconfig-vite · Claude (Lane F) · 2026-06-10
- [ ] P0-2 Scaffold `src/` tree: `core/`, `modules/` (11 modules), `infrastructure/`, `design-system/`, `app/` exactly per [01-system-architecture.md](docs/architecture/01-system-architecture.md) §Module Structure
- [ ] P0-3 Capacitor init + Android (API 24+) / iOS (15+) platforms; **V1 manifest must request NO network permission** `[SEC]` (§3.5 offline-only guarantee)
- [ ] P0-4 SQLite + SQLCipher setup, migration runner, DAOs, FTS5 — [docs/architecture/09-database-design.md](docs/architecture/09-database-design.md) `[SEC]` (§3.2 encryption params, §3.4 key storage)
- [ ] P0-5 Filesystem abstraction (native + web fallback), temp-file cleanup on launch — [01](docs/architecture/01-system-architecture.md) §Infrastructure, `[SEC]` §3.3
- [ ] P0-6 Design-system foundation: tokens CSS, base components (atoms), 3 density modes — [docs/design-system/design-tokens.md](docs/design-system/design-tokens.md), [component-library.md](docs/design-system/component-library.md), [design-principles.md](docs/design-system/design-principles.md)
- [ ] P0-7 Agent interface infrastructure: Action Registry, `data-agent-*` conventions, `pnpm agent:lint` + `agent:sitemap` scripts — [docs/design-system/agent-interface.md](docs/design-system/agent-interface.md)
- [ ] P0-8 i18n setup (react-i18next, en + hi locale files, language detector) — [docs/architecture/12-i18n-multilingual.md](docs/architecture/12-i18n-multilingual.md) `[I18N]`
- [ ] P0-9 CI pipeline: lint, type-check, test+coverage gates, bundle-size check, `pnpm audit`, agent:lint, Lighthouse — [CONTRIBUTING.md](CONTRIBUTING.md) §Performance & Security `[PERF]`
- [ ] P0-10 App shell: routes, lazy imports, providers (Theme/I18n/Database/AI), error boundaries with **local-only** error logging `[SEC]`
- [ ] P0-11 Logging infrastructure per [docs/architecture/14-observability-logging.md](docs/architecture/14-observability-logging.md): pino root/child loggers, redaction denylist + tests, SQLite `app_logs` ring buffer, hash-chained `audit_logs` DAO, worker log relay, pino-pretty dev pipeline `[SEC]` `[LEGAL]` (consent/audit records are DPDP evidence)

---

## Parallel Workstreams (how to split V1 after Phase 0)

> Full rules: [docs/guides/parallel-development.md](docs/guides/parallel-development.md) (lanes, claim-by-commit, protocol-first waves, contract tests). Summary:

| Lane | Scope | Items | Can start when |
|---|---|---|---|
| A — Vault & Search | document-vault, search | F-1, 9–12, 24–26, 30, 32–34 | Phase 0 done |
| B — PDF Engine | pdf-engine | F-3–7, 21, 22, 28 | Phase 0 done |
| C — Image & Scanner | image-engine, document-scanner, OCR | F-2, 8, 20, 29 | Phase 0 done (mocks for A) |
| D — AI Assistant | ai-assistant | F-13–15, 23 | Interfaces of A/B/C exist as mocks (Wave 1) |
| E — Auth, Settings, i18n | auth, settings, core/i18n | F-16–18, 27, 31 | Phase 0 done |
| F — Platform (gatekeeper) | design-system, app shell, infrastructure, packages/, CI | P0-1…P0-11, G1 gates | now |

---

## V1 — Local-First Document Vault (offline; no data leaves device)

> Theme & scope: [feature-priorities.md](docs/business-model/feature-priorities.md) §V1 · Module spec refs per section. **V1 modules must never import V2/V3 code.**

### Document Vault module — [docs/architecture/02-document-vault-module.md](docs/architecture/02-document-vault-module.md)

- [ ] F-1 Document Upload (camera/gallery/file picker; PDF, JPG, PNG, HEIC, WEBP) 🔴Must
- [ ] F-9 Folder Organization (CRUD, color-code, nesting, move docs) 🔴Must
- [ ] F-10 Tags / Labels 🔴Must→🟢S
- [ ] F-24 Document Thumbnails (generate + cache) 🟡Should
- [ ] F-25 Bulk Operations (multi-select delete/move/tag/merge) 🟡Should
- [ ] F-26 Storage Statistics 🟡Should
- [ ] F-32 Recent Documents 🔵Could
- [ ] F-33 Favorites 🔵Could
- [ ] F-34 Sort Options 🔵Could
- [ ] F-30 Document Templates 🔵Could
- [ ] F-31 Export/Backup to local ZIP 🔵Could `[SEC]` (encrypted backup, §3.4 `backup_encryption_key`)

### Document Scanner module — [02-document-vault-module.md](docs/architecture/02-document-vault-module.md) (scan flows) + [04-image-engine-module.md](docs/architecture/04-image-engine-module.md)

- [ ] F-2 Document Scanning (edge detection, perspective correction, crop) 🔴Must→🔴L

### PDF Engine module — [docs/architecture/03-pdf-engine-module.md](docs/architecture/03-pdf-engine-module.md) (all ops in Web Workers `[PERF]`)

- [ ] F-3 PDF Merge 🔴Must
- [ ] F-4 PDF Split 🔴Must
- [ ] F-5 PDF Compress 🔴Must
- [ ] F-6 PDF → Image 🔴Must
- [ ] F-7 Image → PDF 🔴Must
- [ ] F-21 PDF Encryption 🟡Should `[SEC]`
- [ ] F-22 PDF Decryption 🟡Should `[SEC]` (never log/store passwords)
- [ ] F-28 PDF Form Filling 🔵Could

### Image Engine module — [docs/architecture/04-image-engine-module.md](docs/architecture/04-image-engine-module.md)

- [ ] F-8 Image Format Conversion (JPG/PNG/WEBP, HEIC in) 🔴Must
- [ ] F-29 Image Filters/Enhancement 🔵Could

### Search module — [02-document-vault-module.md](docs/architecture/02-document-vault-module.md) §Search + [09-database-design.md](docs/architecture/09-database-design.md) (FTS5)

- [ ] F-11 Full-Text Search 🔴Must
- [ ] F-12 Filters (type/date/size/tags/folder) 🔴Must
- [ ] F-20 OCR Text Extraction (tesseract.js, worker) 🟡Should `[SEC]` (OCR text is sensitive data — encrypted DB only) `[I18N]` (Hindi OCR)

### AI Assistant module — [docs/architecture/05-ai-assistant-module.md](docs/architecture/05-ai-assistant-module.md)

- [ ] F-13 AI Chatbot (on-device WebLLM) 🔴Must→⚫XL `[SEC]` §5 (metadata-only boundary, model checksum) — agent surface per [agent-interface.md](docs/design-system/agent-interface.md)
- [ ] F-14 AI Tool Calling (document ops via function calls) 🔴Must `[SEC]` §5.3 (user confirmation for destructive ops — non-negotiable)
- [ ] F-15 Voice Input (native STT, hold-to-speak) 🔴Must `[A11Y]` (voice-first users) `[I18N]` (hi + en)
- [ ] F-23 AI Screen Navigation 🟡Should (via Action Registry, not DOM hacks)

### Auth & Security module — [10-security-architecture.md](docs/architecture/10-security-architecture.md) §3

- [ ] F-16 Biometric Lock (app-level, auto-lock on background) 🔴Must `[SEC]`
- [ ] SEC-V1 Complete **all 13 V1 items** in [10-security-architecture.md](docs/architecture/10-security-architecture.md) §8 checklist (SQLCipher, key storage, per-doc lock, screenshot prevention, app-switcher blur, temp cleanup, no network perms, no analytics SDKs, root-detection warning, encrypted backup, full data erasure, CSP). **All P0s block release.**

### Settings & UX — [02-document-vault-module.md](docs/architecture/02-document-vault-module.md) §Settings

- [ ] F-17 Multilingual UI (hi + en, all strings externalized) 🔴Must `[I18N]` `[A11Y]`
- [ ] F-18 Dark Mode (system + manual) 🔴Must — dark tokens in [design-tokens.md](docs/design-system/design-tokens.md)
- [ ] F-27 Onboarding Tutorial 🟡Should `[A11Y]` (8th-grade reading level)
- [ ] F-19 Offline-First Architecture (verify: airplane-mode test of every feature) 🔴Must `[SEC]` §3.5

### V1 Release Gate (all must pass before store submission)

- [ ] G1-1 All 🔴 Must features (F-1…F-19) checked above
- [ ] G1-2 SEC-V1 all P0 security items verified `[SEC]`
- [ ] G1-3 WCAG 2.1 AA audit: TalkBack + VoiceOver walkthrough, 200% zoom, screen-reader script — [11-accessibility-a11y.md](docs/architecture/11-accessibility-a11y.md) §6
- [ ] G1-4 Performance budgets met (gzipped JS < 500KB, FCP < 2s, Lighthouse > 90 on mid-range Android) `[PERF]`
- [ ] G1-5 Legal pre-launch: publish [docs/legal/privacy-policy.md](docs/legal/privacy-policy.md) + [docs/legal/terms-and-conditions.md](docs/legal/terms-and-conditions.md); in-app About → licenses + policy links `[LEGAL]`
- [ ] G1-6 Store data-safety declarations match reality exactly (V1: no data collected/shared) `[LEGAL]`
- [ ] G1-7 "Must-do before launch" items in [docs/indian-compliance-checklist.md](docs/indian-compliance-checklist.md) §V1-relevant `[LEGAL]`
- [ ] G1-8 Landing page implemented per [docs/landing-page.md](docs/landing-page.md)
- [ ] G1-9 DPIA reviewed for V1 scope `[DPIA]`

---

## V2 — Cloud & Sharing (first version where data can leave the device — compliance-heavy)

> Refs: [feature-priorities.md](docs/business-model/feature-priorities.md) §V2 · [docs/architecture/06-sharing-module.md](docs/architecture/06-sharing-module.md) · [10-security-architecture.md](docs/architecture/10-security-architecture.md) §4 · **Every feature here is `[LEGAL]` `[CONSENT]` by default.**

### Backend & Identity

- [ ] F-49 User Authentication (phone OTP + optional email) 🔴Must `[SEC]` `[LEGAL]` (DPDP: minimal data; consent log)
- [ ] V2-INFRA Cloud infrastructure — **India-region hosting only** for anything touching user data `[LEGAL]` (data residency, [code/code-standards-and-quality.md](code/code-standards-and-quality.md) §3) `[DPIA]`
- [ ] V2-CERT CERT-In incident-reporting readiness + breach-notification runbook — [10](docs/architecture/10-security-architecture.md) §9 + [indian-compliance-checklist.md](docs/indian-compliance-checklist.md) `[LEGAL]`

### Cloud Backup & Sync

- [ ] F-45 Cloud Backup (E2E-encrypted, opt-in only) 🔴Must→⚫XL `[SEC]` §4.1 `[CONSENT]` `[DPIA]`
- [ ] F-50 Multi-Device Sync 🔴Must→⚫XL `[SEC]` (key management documented) `[CONSENT]`
- [ ] F-57 Trash / Recycle Bin (30-day soft delete) 🟡Should `[LEGAL]` (deletion requests purge ≤30 days)
- [ ] F-58 Version History 🟡Should

### Sharing — [06-sharing-module.md](docs/architecture/06-sharing-module.md)

- [ ] F-46 Secure Document Sharing (encrypted TTL links) 🔴Must `[SEC]` §4 (E2E, TLS 1.3 + pinning, zero-knowledge server) `[CONSENT]`
- [ ] F-47 Access Codes (PIN on shares) 🔴Must `[SEC]` §4.3 (rate limiting, backoff)
- [ ] F-48 Share Link Management (view/revoke/counts) 🔴Must `[SEC]` §4.4–4.5 (audit log, instant revocation)
- [ ] F-52 Share Permissions (view vs download) 🟡Should
- [ ] F-53 Max View Limits 🟡Should
- [ ] F-54 Family Sharing / Team Folders 🟡Should `[CONSENT]`
- [ ] F-60 Document Watermarking 🔵Could `[SEC]` §4.2
- [ ] F-61 QR Code Sharing 🔵Could
- [ ] F-62 Email Document 🔵Could
- [ ] F-59 WhatsApp Share Integration 🔵Could

### Intelligence & Notifications

- [ ] F-51 Document Expiry Alerts 🔴Must `[SEC]` (AI metadata boundary still applies)
- [ ] F-55 Advanced OCR (handwriting, hi+en) 🟡Should `[I18N]`
- [ ] F-56 Push Notifications 🟡Should `[LEGAL]` (adds FCM/APNs — update store data-safety declarations!)
- [ ] F-63 Premium Themes 🔵Could

### V2 Release Gate

- [ ] G2-1 All 10 V2 items in [10-security-architecture.md](docs/architecture/10-security-architecture.md) §8 checklist (items 14–23); P0s block release `[SEC]`
- [ ] G2-2 Consent screens implemented with exact copy from [docs/ux/consent-screens.md](docs/ux/consent-screens.md), localized `[CONSENT]` `[I18N]`
- [ ] G2-3 Consent logging live (user id, ISO-8601 ts, action, scope, UA, request id; 2-yr retention) `[LEGAL]`
- [ ] G2-4 Privacy policy + T&C updated for cloud/sharing scope; user re-consent flow `[LEGAL]`
- [ ] G2-5 DPIA updated for backup/share/sync flows `[DPIA]`
- [ ] G2-6 Pen-test of sharing backend; report stored per [docs/compliance/index.md](docs/compliance/index.md) evidence conventions
- [ ] G2-7 Store data-safety declarations updated (no longer "no data collected") `[LEGAL]`

---

## V3 — Consumer CSC Services (government integrations — highest legal exposure)

> Refs: [feature-priorities.md](docs/business-model/feature-priorities.md) §V3 · [docs/architecture/07-csc-services-module.md](docs/architecture/07-csc-services-module.md) · **Kagaz is a facilitator, never an official government service.**

### Service Platform

- [ ] F-69 Service Catalog (50+ services, requirements, fees) 🔴Must→⚫XL `[LEGAL]` (fees/timelines verifiable against official sources — consumer-protection liability)
- [ ] F-70 Guided Application Flows 🔴Must→⚫XL `[A11Y]` `[I18N]`
- [ ] F-71 Fee Transparency (govt fee + platform fee = total) 🔴Must `[LEGAL]`
- [ ] F-72 My Application Tracking 🔴Must
- [ ] F-73 Payment Integration (UPI/cards/net banking) 🔴Must `[LEGAL]` (RBI/payment-gateway compliance, PCI-DSS via gateway — see [indian-compliance-checklist.md](docs/indian-compliance-checklist.md)) `[DPIA]`

### Assistance & Reach

- [ ] F-74 AI Form Auto-fill from OCR 🟡Should `[SEC]` (user must review before any submission to authority) `[LEGAL]`
- [ ] F-75 Nearest CSC Locator 🟡Should `[LEGAL]` (location permission — update privacy policy + store declarations)
- [ ] F-76 Operator Ratings (consumer-side) 🟡Should `[LEGAL]` (defamation/moderation policy in T&C)
- [ ] F-77 Receipt Generation 🟡Should
- [ ] F-78 Additional Languages (ta, te, bn, mr, gu, kn) 🟡Should `[I18N]` — [12-i18n-multilingual.md](docs/architecture/12-i18n-multilingual.md)
- [ ] F-79 Smart Document Suggestions 🟡Should
- [ ] F-80 DigiLocker Integration 🔵Could `[LEGAL]` — full packet: [docs/integration/digilocker-onboarding.md](docs/integration/digilocker-onboarding.md); **never store raw Aadhaar numbers/biometrics** ([code/code-standards-and-quality.md](code/code-standards-and-quality.md) §2) `[CONSENT]` `[DPIA]`
- [ ] F-81 Referral Rewards 🔵Could
- [ ] F-82 Community Tips 🔵Could `[LEGAL]` (UGC moderation)

### V3 Release Gate

- [ ] G3-1 CSC partnership MOU executed per [docs/integration/csc-mou-template.md](docs/integration/csc-mou-template.md) `[LEGAL]`
- [ ] G3-2 DigiLocker/NeGD onboarding approved (if F-80 shipped) — [digilocker-onboarding.md](docs/integration/digilocker-onboarding.md)
- [ ] G3-3 Payment-gateway compliance evidence filed in [docs/compliance/index.md](docs/compliance/index.md)
- [ ] G3-4 Full [indian-compliance-checklist.md](docs/indian-compliance-checklist.md) review with legal counsel `[LEGAL]`
- [ ] G3-5 T&C updated: service-facilitation terms, fees, refunds, disputes `[LEGAL]`
- [ ] G3-6 DPIA updated for government-integration flows `[DPIA]`

---

## V4 — Kagaz Operator (separate app; consumer app stays clean)

> Refs: [feature-priorities.md](docs/business-model/feature-priorities.md) §V4. ⚠️ Referenced spec `docs/architecture/13-app-portfolio.md` **does not exist yet** — write it before starting V4 (see [Doc Gaps](#doc-gaps--maintenance)).

- [ ] F-90 Operator Onboarding & KYC (Aadhaar+PAN verification) 🔴Must `[LEGAL]` (UIDAI rules — consented verification only, no raw Aadhaar storage) `[CONSENT]` `[DPIA]`
- [ ] F-91 Operator Dashboard 🔴Must
- [ ] F-92 Customer Management / CRM (consent-based document grants) 🔴Must `[CONSENT]` `[LEGAL]`
- [ ] F-93 Service Processing Workflow 🔴Must
- [ ] F-94 Subscription Billing (₹499/mo, dunning) 🔴Must `[LEGAL]`
- [ ] F-95 GST-Compliant Receipts & Invoicing 🔴Must `[LEGAL]` (GST law)
- [ ] F-96…F-104 Should/Could items — see [feature-priorities.md](docs/business-model/feature-priorities.md) §V4

---

## Continuous Obligations (never "done" — re-verify each release)

| Obligation | Cadence | Reference |
|---|---|---|
| `pnpm audit` clean, dependencies updated | Every PR / monthly | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Coverage ≥80/75, lint, type-check green | Every PR | [CONTRIBUTING.md](CONTRIBUTING.md) |
| A11y manual protocol (TalkBack/VoiceOver, zoom, contrast) | Every sprint | [11-accessibility-a11y.md](docs/architecture/11-accessibility-a11y.md) §6 |
| Docs updated with code (docs-as-code) | Every PR | [AGENT.md](AGENT.md) |
| Compliance evidence index current | On any new integration/vendor/audit | [docs/compliance/index.md](docs/compliance/index.md) |
| Privacy policy / T&C match actual behavior | Every release | [docs/legal/](docs/legal/) |
| Store data-safety declarations match behavior | Every release | [indian-compliance-checklist.md](docs/indian-compliance-checklist.md) |
| Design-system drift check (screens match rules) | Every sprint | [docs/design-system/README.md](docs/design-system/README.md) |

---

## Doc Gaps & Maintenance

- [x] `docs/architecture/13-app-portfolio.md` was referenced by [feature-priorities.md](docs/business-model/feature-priorities.md) but missing — created. ✅ 31edc93 (2026-06-10)
- [x] Stale lowercase `docvault` identifiers (`@docvault/*` scope, `app.docvault.in`, `docvault.db`, backup filenames, broken a11y TOC anchor) renamed to `kagaz` equivalents. ✅ 31edc93 (2026-06-10)
- [x] `package.json` `agent:lint` / `agent:sitemap` scripts added as **fail-loud stubs** (`scripts/agent-*.mjs`) — real implementation remains P0-7. ✅ 4080a21 (2026-06-10)
- [x] Dependency overhaul: nonexistent packages fixed (`@capacitor/biometrics` → `@aparajita/capacitor-biometric-auth`, ADR-014), react-router pinned to v5 (Ionic peer requirement), all versions verified against npm, missing doc-required deps added, ESLint 10 flat config, Vitest 4 config. ✅ 4080a21 (2026-06-10)
- [x] Monorepo adopted (ADR-015): pnpm workspaces + Turborepo; `apps/kagaz`, `apps/docs`, `packages/` with extraction rules. Docs' `src/` paths = `apps/kagaz/src/`. ✅ 05d074b (2026-06-10)
- [x] `docs/guides/parallel-development.md` (referenced by AGENT.md but missing) created: lanes, claim-by-commit, protocol-first waves, contract tests, skill-file integration. ✅ _(this commit)_ (2026-06-10)
- [ ] `docs/api-reference/` is referenced by [AGENT.md](AGENT.md) but doesn't exist — create the folder + per-module reference pages as modules land their first public APIs.

---

## Commit Journal

> Append-only log. One line per meaningful commit (or group), newest first: `YYYY-MM-DD · <hash> · <type(scope)> · what & why · linked checklist item(s)`.

- 2026-06-10 · _(this commit)_ · chore(deps) · TypeScript 6.0.3 (typescript-eslint ceiling) + tsgo beta (`type-check:native`, Go-native 10× checker); TS-7-switch criteria recorded in 08's Dependency Version Policy · pre-P0-1
- 2026-06-10 · d02945e · docs · Parallel-development guide + lane table + claim protocol in checklist + CLAUDE.md workspace/pnpm/parallel rules · Doc Gaps
- 2026-06-10 · 05d074b · build(monorepo) · pnpm workspaces + Turborepo, apps/kagaz + apps/docs + packages/, ADR-015 · Doc Gaps, pre-P0-1
- 2026-06-10 · 4080a21 · chore(tooling) · Dependency overhaul (verified npm versions, fixed nonexistent packages, react-router v5 pin, ESLint 10 flat config, Vitest 4, agent script stubs) · Doc Gaps, pre-P0-1
- 2026-06-10 · ec13175 · docs(architecture) · Added 14-observability-logging.md (pino, three log streams, hash-chained audit logs, redaction) + ADR-013/014 + dependency version policy · P0-11
- 2026-06-10 · 31edc93 · docs · Added 13-app-portfolio.md, renamed docvault→kagaz identifiers, marked roadmap gantt dates aspirational · Doc Gaps
- 2026-06-10 · da34430 · docs · Created DEVELOPMENT-CHECKLIST.md and updated CLAUDE.md with checklist-first + commit-discipline rules · (meta)
