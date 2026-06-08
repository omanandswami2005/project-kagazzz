# Kagaz — Design System

> **Kagaz by Omni Docs** — *Sab kagaj, ek Jagah.* / *All your papers, one place.*
>
> The complete design system for Kagaz. Seven files, one source of truth.
> If something on screen doesn't match a rule in this folder, the rule wins or this folder gets a PR.

---

## Files in reading order

| # | File | What's in it | When you read it |
|---|---|---|---|
| 1 | **[design-principles.md](./design-principles.md)** | The 8 governing principles, the anti-patterns we reject, "modern and clean" defined. | First. Any design debate ends here. |
| 2 | **[design-tokens.md](./design-tokens.md)** | Colors, type, spacing, radii, shadows, motion, density modes, agent-inspector tokens. | When you reach for a hardcoded value — there's a token for it. |
| 3 | **[interaction-patterns.md](./interaction-patterns.md)** | Gestures, FAB rules, sheets vs modals, swipe actions, selection mode, density, voice, low-literacy patterns. | When you're choosing *how* a component behaves. |
| 4 | **[component-library.md](./component-library.md)** | Atoms → Molecules → Organisms → Pages. Every component's props, states, a11y, agent surface. | When you're picking the component to use. |
| 5 | **[agent-interface.md](./agent-interface.md)** | The three-layer AI-agent contract: `data-agent-*` DOM attrs, Action Registry, Page Skills. Form-filling protocol. | When you're building anything an agent should drive — which is everything. |
| 6 | **[page-skill-template.md](./page-skill-template.md)** | Copy-paste templates for `PageName.agent.ts` + `PageName.skill.md`. Worked example for `vault.list`. | When you're adding a new page. |

---

## The 60-second tour

Kagaz's design system is built on four ideas:

1. **One primary action per screen.** Decision fatigue kills task completion for low-literacy users — eliminate it.
2. **Three densities** (Simple / Comfortable / Compact). A user toggle, not a per-screen choice. One token-swap, app-wide effect.
3. **Voice = touch = agent.** Every action is registered once in a typed Action Registry. Voice commands, AI tool calls, computer-use bots, and E2E tests all hit the same surface.
4. **Per-page Skills.** Every page ships a `.skill.md` natural-language file (loaded into the AI's context) and a `.agent.ts` typed manifest (consumed by code). New pages can't merge without them.

---

## What's intentionally NOT here

- Component implementations (React/TSX) — that's the `packages/ui` workspace.
- Marketing/brand guidelines — separate.
- Government-design-system styles (UX4G) — we evaluated and chose against it. See git history for the analysis. We borrow tokens, not components.

---

## How to make a change

1. Open a PR that updates the relevant `.md` file.
2. If the change is cross-cutting (touches principles + tokens + components), update all three in the same PR.
3. Lint runs: `pnpm design-system:lint` (catches: a token referenced but not defined, an action listed but missing from registry, an `.agent.ts` whose actions don't appear in the matching `.skill.md`).
4. Two reviews required: one design, one engineering.

---

*Maintained by the Kagaz platform team · v2.0 · 2026-06-08*
