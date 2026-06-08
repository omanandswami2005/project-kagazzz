# Code Standards & Quality — Kagaz (Omni Docs)

Last updated: 2026-06-08

This document captures coding standards, quality gates, tooling, and processes for the Kagaz codebase. It is a living artifact intended to help engineers ship maintainable, secure, and high-quality software across mobile, web, and backend components.

Layout / where to put this file

- Path: `code/code-standards-and-quality.md`
- Keep this file in the `code/` folder. Add related automation (linters, CI config, commit hooks) in their respective folders.

Principles

- Correctness first: tests and types are primary guards.
- Maintainability: readable code, small PRs, consistent style.
- Security & privacy: threat modelling, secure defaults, and least privilege.
- Developer experience: fast feedback loops (local lint/test), clear CI signals.

1. Languages & stacks

- Frontend (marketing + app web): Astro + Preact + TypeScript for landing/marketing islands (as recommended in docs). Follow Preact/React patterns where applicable.
- Mobile: Capacitor + TypeScript (shared packages where feasible).
- Shared packages: `packages/ui`, `packages/libs` in a pnpm monorepo.
- Backend (if present): Node.js + TypeScript or Go (document and decide in architecture docs).

2. TypeScript

- Always use TypeScript for new code.
- tsconfig.json defaults:
  - "strict": true
  - "noImplicitAny": true
  - "noImplicitReturns": true
  - "exactOptionalPropertyTypes": true
  - "forceConsistentCasingInFileNames": true
- Prefer `unknown` over `any` and always narrow before use.
- Keep `eslint` and `typescript` aligned (rules that conflict must be resolved in ESLint config).

3. Formatting & linting

- Formatting: Prettier as the single source of truth for code format. Add `.prettierrc` and apply via lint-staged.
- Linting: ESLint with recommended TypeScript, React/Preact, accessibility and security plugins.
  - Plugins: `@typescript-eslint`, `eslint-plugin-react` (or preact plugin), `eslint-plugin-jsx-a11y`, `eslint-plugin-security`.
- Style rules:
  - 2-space indentation
  - Single quotes for JS/TS, backticks for templates
  - Trailing commas in multi-line objects/arrays
  - Max line length: 100 characters, exceptions for long strings
- Commit hooks: Husky + lint-staged to run Prettier and ESLint on staged files.

4. Commit messages & branching

- Commit message style: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`).
- Branch strategy: feature branches off `main` named `feature/<short-name>`, bugfixes `fix/<short-name>`, hotfixes `hotfix/<short-name>`.
- Pull requests: small (<= 400 lines changed where possible), one feature per PR, include description, screenshots, and test plan.

5. Pull request & review process

- Two approvals required: one engineering and one product/design for UI changes.
- PR checklist (must be included in PR description):
  - Tests added/updated
  - Lint passes locally
  - Type checks pass
  - Storybook / visual preview attached for UI changes
  - Accessibility considerations noted
  - Performance impact considered (bundle size estimate)
- Use GitHub draft PRs while work-in-progress.

6. Testing

- Unit tests: Node + Jest or Vitest for frontend packages.
  - Target: > 80% coverage for critical packages; enforce per-package thresholds pragmatically.
- Integration tests: Playwright / Detox for mobile flows; Playwright for web E2E.
- Accessibility tests: jest-axe rules for components and manual checks for critical flows.
- CI: run unit tests, type checks, and E2E smoke tests on PRs.

7. CI/CD

- CI pipeline (example):
  1. install -> pnpm install
  2. prebuild checks -> lint, typecheck, unit tests
  3. build -> production build artifacts
  4. e2e smoke -> Playwright tests
  5. bundle size + security scan -> Snyk/Dependabot
- Release: semantic-release for automated changelog and package releases, or manual gated release for app stores.
- Protect `main` branch with required checks: passing CI, minimum approvals, and up-to-date with main before merge.

8. Dependency management

- Use pnpm in monorepo mode. Keep dependency versions fixed.
- Dependabot or Renovate for upgrade PRs, with automated tests required before merge.
- Avoid large runtime dependencies; prefer lightweight libraries for mobile.

9. Security practices

- Secrets: never check secrets into git. Use environment variables and secret management (GitHub Secrets, or HashiCorp Vault for infra).
- Static analysis: use Snyk or npm audit in CI; run SAST tools for server-side code.
- Code scanning: enable GitHub CodeQL and SAST/DAST tools.
- Third-party packages: audit transitive deps, track high-risk packages, and have a mitigation plan.
- cryptography: use well-vetted APIs (Web Crypto, libsodium bindings), do not roll your own crypto.

10. Data protection & privacy-by-design

- Default to on-device processing (as in product docs).
- Explicit consent required for any cloud processing or third-party sharing flows; record consent with timestamp and UA.
- Keep minimal logs and store audit logs in India-region infra.
- For backups and sync, implement E2EE where only the user controls the keys. If server-side metadata is required, minimize sensitive metadata stored.

11. Observability & logging

- Logs: structured logs with correlation IDs, but avoid logging sensitive PII. Mask or redact IDs (Aadhaar, PAN) in logs.
- Metrics: request latency, error rates, queue lengths, OCR job durations, eSign success rates.
- Alerts: high error rates, failed background jobs, security anomalies.

12. Accessibility

- All UI components must be keyboard-navigable and screen-reader friendly.
- Follow WCAG 2.1 AA where feasible.
- Use `aria-*` attributes and semantic HTML.
- Include accessibility checks in CI (axe) and manual testing with screen readers for major flows.

13. Performance & bundle size

- Keep landing marketing bundle small (< 100 KB gzipped target from docs). Use Astro static-first + islands for interactivity.
- Lazy-load non-critical assets, defer Lottie until in-viewport, and optimize images (AVIF/WebP fallbacks).
- Measure LCP, TTI, TTFB in CI for critical pages and keep budgets in PR checklist.

14. Internationalization & localization

- Extract strings to i18n resource files. Provide translations for Hindi and other launch languages.
- Date, number, and currency formatting must be locale-aware.

15. Documentation

- Keep a living `README.md` at package roots with setup, test and build instructions.
- Each package should include `CONTRIBUTING.md` for package-specific rules.
- Document public APIs with typed interfaces and examples.

16. Code ownership & CODEOWNERS

- Use `CODEOWNERS` to assign reviewers for critical paths (`/apps/marketing/` => frontend owner, `/packages/ui/` => UI owner).
- Keep ownership small and rotate to avoid bottlenecks.

17. Quality gates (enforced in CI)

- ESLint: no new lint errors allowed.
- TypeScript: no `any` in exported APIs (except explicitly allowed via `// eslint-disable` with justification).
- Tests: unit tests for new features; PRs must not reduce coverage below defined thresholds.
- Security: fix critical/high Snyk issues before merging.

18. Mobile-specific

- Keep API surfaces small; graceful degradation for offline.
- Respect `prefers-reduced-motion` and accessibility settings.
- Use platform keystore and biometric APIs correctly and securely.
- Use proper storage: scoped app storage, not world-readable storage.

19. API contracts

- Version your APIs and document changes in changelogs.
- Use OpenAPI / JSON Schema for backend APIs and validate requests/ responses in staging.

20. Release & versioning

- Use semantic versioning for packages (`MAJOR.MINOR.PATCH`).
- Tag releases in git and create change logs automatically with semantic-release or manually maintain `CHANGELOG.md`.

21. Onboarding checklist for new engineers

- README: dev environment setup (`pnpm install`, `.env.example`, `pnpm dev`)
- Run local linters & tests before opening PR
- Read the architecture and security docs (links in repo)

22. Governance & periodic reviews

- Quarterly code quality review and dependency audit.
- Annual security pen test for critical releases.

Appendix: Recommended toolchain

- Package management: pnpm
- Formatter: Prettier
- Linter: ESLint + @typescript-eslint
- Testing: Vitest / Jest (unit), Playwright (E2E)
- CI: GitHub Actions
- Dependency updates: Dependabot / Renovate
- Security: Snyk or GitHub Dependabot security alerts + CodeQL
- Secret management: GitHub Secrets (or Vault for infra)
- Commit hooks: Husky + lint-staged
- Release: semantic-release (or manual release for stores)

---

This file is a starting standard for the team. Adjust thresholds and tools to match the team size and product requirements. Keep this doc updated as the codebase evolves.
