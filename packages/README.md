# packages/ — Shared Workspace Packages

> Shared code between `apps/kagaz` and (V4) `apps/kagaz-operator` lives here as pnpm workspace packages. See [docs/architecture/13-app-portfolio.md](../docs/architecture/13-app-portfolio.md) §4 and ADR-015 in [docs/architecture/08-tech-stack-decisions.md](../docs/architecture/08-tech-stack-decisions.md).

Planned packages (create on first real need, not speculatively — extract from `apps/kagaz` when a second consumer appears or the design system demands it):

| Package | Contents | When to extract |
|---|---|---|
| `@kagaz/design-tokens` | Token CSS, density modes, themes | P0-6 (design system mandates it as the single source of truth) |
| `@kagaz/ui` | Design-system component implementations | P0-6 |
| `@kagaz/agent-kit` | `defineAction`, `definePage`, `useAgentProps` | P0-7 |
| `@kagaz/agent-test` | Action-Registry-driven E2E harness | P0-7 |
| `@kagaz/core` | Shared utils, types, i18n plumbing | When operator app starts (V4) |
| `@kagaz/pdf-engine` | PDF operation workers | When operator app starts (V4) |

Rules:

- Every package: `name` scoped `@kagaz/*`, `private: true` until publish is a real decision, own `type-check` + `test` scripts (Turborepo runs them), `__tests__/` beside source.
- Apps depend on packages via `"@kagaz/ui": "workspace:*"`.
- A package never imports from an app, and never from another app-specific module.
