# design-system/

Shared UI: `components/` (atoms — Button, Card, Modal, …), `layouts/`, `theme/` (tokens CSS, dark mode, high contrast — P0-6), `animations/`.

Rules (binding, [docs/design-system/](../../../../docs/design-system/)):

- Never hardcode visual values — tokens from [design-tokens.md](../../../../docs/design-system/design-tokens.md) only.
- Components come from [component-library.md](../../../../docs/design-system/component-library.md); behavior per [interaction-patterns.md](../../../../docs/design-system/interaction-patterns.md); 3 density modes (Simple/Comfortable/Compact).
- Every interactive element gets `data-agent-id` (+ `data-agent-state` when stateful) per [agent-interface.md](../../../../docs/design-system/agent-interface.md).
- WCAG 2.1 AA per-component checklist ([11-accessibility-a11y.md](../../../../docs/architecture/11-accessibility-a11y.md) §7) is a launch gate.
