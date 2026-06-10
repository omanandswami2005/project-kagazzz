#!/usr/bin/env node
/**
 * agent:lint — verifies the agent interface contract:
 *   - data-agent-id on every interactive element
 *   - data-agent-state on every stateful element
 *   - every page ships PageName.agent.ts + PageName.skill.md
 *
 * Spec: docs/design-system/agent-interface.md
 * Templates: docs/design-system/page-skill-template.md
 *
 * STUB: real implementation is DEVELOPMENT-CHECKLIST.md item P0-7.
 * Fails loudly so CI never silently passes without the real check.
 */
console.error(
  '[agent:lint] Not implemented yet — build it as part of P0-7 (see DEVELOPMENT-CHECKLIST.md).'
);
process.exit(1);
