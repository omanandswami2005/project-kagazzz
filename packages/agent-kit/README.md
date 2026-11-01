# @kagaz/agent-kit

Agent interface primitives (P0-7). Spec: [docs/design-system/agent-interface.md](../../docs/design-system/agent-interface.md) — the three-layer contract between UI, on-device assistant (V1), and remote agents (V2+).

| Export | Layer | Purpose |
|---|---|---|
| `useAgentProps` | 1 — DOM | data-agent-* bag + dev `agent:render` events for the AgentInspector |
| `AGENT_STATES` / `AgentState` | 1 | The fixed state vocabulary (no custom values without an RFC) |
| `defineAction` / `ActionMap` | 2 — Registry | One typed entry per voice/agent command; Zod args schema |
| `ActionRegistry` | 2 | register/invoke (validated, `ActionResult` envelope, never throws) + `toToolDefinitions()` for the on-device AI assistant (LiteRT-LM, F-13) |
| `definePage` | 3 — Page Skill | Typed page manifest; validates primary ∈ available, voice examples resolve |
| `ActionResult` | — | `{ ok, data } \| { ok:false, code, retryable, userMessage }` failure semantics |

Related tooling: `pnpm agent:lint` (pages ship `.agent.ts` + `.skill.md`, skill-in-sync) and `pnpm agent:sitemap` (emits `apps/kagaz/public/agent-sitemap.json`) live in `scripts/`. `vite-plugin-agent-kit`, `eslint-plugin-agent`, the AgentInspector overlay, and `@kagaz/agent-test` land with the first real pages (they have nothing to inspect until then).
