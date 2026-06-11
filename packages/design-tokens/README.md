# @kagaz/design-tokens

Single source of truth for Kagaz's visual language (P0-6). Spec: [docs/design-system/design-tokens.md](../../docs/design-system/design-tokens.md).

Usage: `import '@kagaz/design-tokens/css';` once at the app root, then only ever `var(--token)` — never hardcode a visual value.

| File | Contents |
|---|---|
| `tokens.css` | Colors, type, spacing, radii, shadows, motion, breakpoints, icons, focus ring, reduced-motion |
| `dark-mode.css` | `[data-theme="dark"]` overrides |
| `density.css` | Simple/Comfortable/Compact modes + Simple Mode pattern suppression (`[data-density]`) |
| `high-contrast.css` | `[data-contrast="high"]` + `prefers-contrast` overrides |
| `agent-inspector.css` | Dev-only AgentInspector surface tokens |
| `index.ts` | Typed mode names, attributes, and guards for JS consumers |

Changing a token requires updating the spec doc in the same PR (docs-as-code).
