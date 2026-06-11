# @kagaz/ui

Design-system component implementations (P0-6: atoms). Spec: [docs/design-system/component-library.md](../../docs/design-system/component-library.md) — props, states, a11y, and agent surface per component are defined there, not here.

Usage: `import { Button } from '@kagaz/ui';` + `import '@kagaz/ui/styles.css';` (after the design-tokens CSS).

Shipped atoms: Button, Input, Checkbox, Radio, Toggle, Badge, Tag, Avatar, Icon, Spinner, ProgressBar — every interactive atom accepts the standard `AgentProps` (`agentId` / `agentAction` / `agentRole`) and emits `data-agent-state` (+ `data-agent-value` for inputs, omitted for passwords).

Rules: styles reference design tokens only; touch targets honor the density token `--target-min`; molecules/organisms land with their feature items; `useAgentProps`/Action Registry integration arrives with `@kagaz/agent-kit` (P0-7).
