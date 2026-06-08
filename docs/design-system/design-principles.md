# Kagaz — Design Principles

> The opinionated rules that govern every screen, component, and interaction in Kagaz.
> If a design decision is unclear, these principles are the tiebreaker.

---

## Audience reality check

Kagaz is used by:

1. **A 22-year-old urban student** filing a scholarship form — fast, comfortable with phones.
2. **A 58-year-old farmer** verifying his land record — owns a phone, types slowly, reads Hindi better than English.
3. **A CSC operator** processing 40 applications/day — needs speed and density.
4. **An on-device AI agent** (V1) and remote agents (V2+) that *operate the app on the user's behalf* — needs structured DOM and semantic actions.

Every screen must work for all four. The principles below are how we make that possible.

---

## The 8 Principles

### 1. One primary action per screen

If the user can do only one thing on this screen, what is it? That action gets the FAB or a single primary button. Everything else is secondary or hidden behind a menu. Decision fatigue kills task completion in low-literacy users — eliminate it.

> Counter-example: a Documents page with "Upload", "Scan", "Import from cloud", "Paste link" all as equally weighted buttons. **Bad.** Pick one (Scan), make the other three a `+` menu.

### 2. Icon + label, always

Never use icon-only buttons in the primary flow. Icons are ambiguous across cultures, ages, and literacy levels. The only exception: standard close (`×`) and back (`‹`) when accompanied by a labeled equivalent (Escape key, swipe-back gesture).

> Why: a user in Bihar who has never seen Material Icons does not know what a hamburger means. A "Menu" label removes the guess.

### 3. Voice is a first-class input

Every action that can be initiated by tap must also be initiable by voice through the AI assistant. The assistant is not an add-on — it is the **alternate primary UI** for low-literacy and low-mobility users. Every page declares its voice surface in its Page Skill (see [agent-interface.md](./agent-interface.md)).

### 4. Reversibility over confirmation

Prefer Undo toasts over confirmation modals for everything except *truly* irreversible actions (encrypt with new password, permanent delete from Trash, share link revocation).

> Confirmation modals interrupt flow; Undo respects the user's time *and* protects them. Modal only when there is no undo.

### 5. Bilingual rendering, never translation-only

Hindi and English are co-equal. The toggle is one tap from any screen (in the top bar). Strings are designed *in both* during copywriting — short Hindi often needs different layout than long English. Never assume a translation will fit.

> Concretely: every page export includes `copy.en.ts` and `copy.hi.ts`. Layout is tested at both extremes plus 200% zoom.

### 6. Density is a setting, not a default

Three modes, picked by user (or inferred from device + Simple Mode toggle):

| Mode | Touch target | Type scale | Density |
|---|---|---|---|
| **Simple** | 64dp | 1.25× | Comfortable | seniors, low literacy |
| **Comfortable** (default) | 48dp | 1.0× | Default | most users |
| **Compact** | 40dp | 0.95× | Dense | CSC operators, power users |

A single design token swap drives all three (see [design-tokens.md § density](./design-tokens.md)).

### 7. Visible state, never hidden state

Every interactive element exposes its state to the eye (visual) **and** to the agent (data-agent-state). Loading, disabled, selected, focused, error — never invisible. This eliminates an entire class of "stuck UI" bugs and makes the app fully drivable by an AI agent.

> See [agent-interface.md § state contract](./agent-interface.md#state-contract).

### 8. AI-agent operability is a design requirement

Every page, form, and component must be operable by:
- A human via touch or keyboard,
- A human via voice,
- An AI agent via the Action Registry,
- An AI agent via DOM operation (Computer-Use-style).

If a feature can be done by tap but not by the agent, **it is incomplete**. This is enforced via lint (`agent-completeness` rule) and the per-page `.skill.md` file (see [agent-interface.md](./agent-interface.md)).

---

## The corollaries

These follow from the 8 principles and resolve common arguments:

| Question | Answer | Principle |
|---|---|---|
| Can we use a tooltip-only label? | No. | #2 |
| Can the destructive action be primary? | Only if undo is available. | #4 |
| Should we hide the language toggle in Settings? | No — always visible in top bar. | #5 |
| Can we use a hover-only menu on mobile? | No. Mobile has no hover. | #2, #7 |
| Should we ship a feature without voice support? | No. Voice is V1, not V2. | #3 |
| Can a custom `<div onClick>` replace a `<button>`? | No. Agents and screen readers both need semantic roles. | #7, #8 |
| Can the empty state link to a video? | Yes, but always with a text-action fallback. | #2 |

---

## What "modern and clean" means here

Not "minimal at all costs." Kagaz holds someone's Aadhaar — sterile minimalism reads as "untrustworthy demo." Concrete style targets:

- **Generous whitespace** (16dp+ between groups, 24dp+ between sections) — calm, not cramped.
- **Soft 12–16px corner radii** — friendlier than sharp; not playful.
- **One accent color in motion** — color earns attention only when it matters (uploads complete, errors, AI is thinking).
- **No drop-shadow stacking** — at most 1 elevation level per screen. Stacked shadows feel busy and clash with low-end Android rendering.
- **System font for body** (Inter on web, system on native) — feels native, loads instantly, scales with system size.
- **Real photos / illustrations are warm and Indian** — empty states show a person, not a sad cloud icon. Aim for the warmth of `kutumb.app`, not the coldness of a SaaS dashboard.
- **Motion is functional, not decorative** — page transitions slide along the navigation axis, modals fade-up, never bounce. Reduced-motion respected.

---

## Anti-patterns we explicitly reject

| Pattern | Why we reject |
|---|---|
| Hamburger menu as primary nav | Hides destinations; tank discoverability. We use bottom tabs. |
| Splash screens longer than 1s | Wastes user's time. We use route-based skeleton screens. |
| Modal-inside-modal | Always rearchitect. Two stacked modals = wrong flow. |
| Toast as the only confirmation for destructive actions | See principle #4. |
| Carousel as primary content | Users miss 90% of slides. Stack vertically. |
| Custom scrollbars on mobile | Native is faster, more accessible. |
| Loading spinners > 2s without progress | Use skeleton + indeterminate bar + cancel. |
| Dark patterns ("Are you sure you want to lose all your data?") | We use plain language: "Delete 3 documents?" |

---

## How a designer uses this file

When proposing a new screen:

1. Identify the **one primary action** (Principle #1).
2. Sketch the **voice command** that achieves it (Principle #3).
3. List every interactive element with its **agent name** (Principle #8 — see [agent-interface.md](./agent-interface.md)).
4. Decide if any action is **truly irreversible** (Principle #4) — if not, no modal.
5. Validate at **64dp / 48dp / 40dp** density (Principle #6).
6. Render copy in **Hindi and English** (Principle #5).
7. Pass to engineering with `.skill.md` filled in (see [page-skill-template.md](./page-skill-template.md)).

---

*Last updated: 2026-06-08 · Kagaz Design System v2.0*
