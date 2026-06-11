# design-system/

**Tokens and component implementations were extracted at P0-6** (per [packages/README.md](../../../../packages/README.md)):

- Tokens / themes / density → [`@kagaz/design-tokens`](../../../../packages/design-tokens/)
- Atoms (Button, Input, …) → [`@kagaz/ui`](../../../../packages/ui/)

This folder keeps only the **app-specific** design-system pieces as they land: `layouts/` (MainLayout, FullScreenLayout, SplitPaneLayout) and `animations/` (page transitions, list animations). `components/` and `theme/` stay empty — add new shared visuals to the packages, not here.

Binding rules ([docs/design-system/](../../../../docs/design-system/)): tokens only (never hardcode visuals); components from [component-library.md](../../../../docs/design-system/component-library.md); `data-agent-id` on every interactive element; WCAG 2.1 AA per-component checklist.
