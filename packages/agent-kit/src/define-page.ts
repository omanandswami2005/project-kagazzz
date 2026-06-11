/**
 * definePage — typed per-page manifest
 * (docs/design-system/agent-interface.md §Layer 3).
 * Consumed by routing, tests, the AgentSitemap generator, and the
 * inspector; the sibling .skill.md is what the LLM reads.
 */
import type { ActionDefinition } from './define-action';

/** Page id: module-prefixed, dot-separated (e.g. `vault.list`). */
const PAGE_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*)*$/;

/** A voice utterance the page should recognize. */
export interface VoiceExample {
  utterance: string;
  action: string;
  args?: Record<string, unknown>;
}

/** Configuration accepted by {@link definePage}. */
export interface PageConfig {
  /** Public, stable page id (e.g. `vault.list`). */
  id: string;
  /** Router path for the page (e.g. `/vault`). */
  route: string;
  /** One-sentence purpose, phrased for the LLM. */
  intent: string;
  /** Presentation surfaces (default: screen). */
  surfaces?: ('screen' | 'modal' | 'sheet')[];
  /** The screen's single primary action (design-principles.md #1). */
  primaryAction?: ActionDefinition;
  /** Every action a user can take here — agent/completeness scope. */
  availableActions: ActionDefinition[];
  /** Selectors the agent reads to decide "did the action succeed?". */
  observableState?: Record<string, () => unknown>;
  /** Named, observable outcomes per action (state contract #4). */
  successPredicates?: Record<string, (ctx: Record<string, unknown>) => boolean>;
  /** Utterance → action examples for the voice index. */
  voiceExamples?: VoiceExample[];
}

/** A validated page manifest. */
export type PageDefinition = Readonly<PageConfig>;

/**
 * Declares a page manifest, failing loudly at module init when the
 * contract is violated (bad id, route, or a primary action that is not
 * among availableActions).
 */
export function definePage(config: PageConfig): PageDefinition {
  if (!PAGE_ID_PATTERN.test(config.id)) {
    throw new Error(
      `Invalid page id "${config.id}" — lowercase, dot-separated, module-prefixed`
    );
  }
  if (!config.route.startsWith('/')) {
    throw new Error(`Page "${config.id}" route must start with "/"`);
  }
  if (
    config.primaryAction &&
    !config.availableActions.some((a) => a.id === config.primaryAction?.id)
  ) {
    throw new Error(
      `Page "${config.id}": primaryAction "${config.primaryAction.id}" must be in availableActions`
    );
  }
  const actionIds = new Set<string>();
  for (const action of config.availableActions) {
    if (actionIds.has(action.id)) {
      throw new Error(
        `Page "${config.id}": duplicate action "${action.id}" in availableActions`
      );
    }
    actionIds.add(action.id);
  }
  for (const example of config.voiceExamples ?? []) {
    if (!actionIds.has(example.action)) {
      throw new Error(
        `Page "${config.id}": voice example "${example.utterance}" references ` +
          `unlisted action "${example.action}"`
      );
    }
  }
  return Object.freeze({ surfaces: ['screen' as const], ...config });
}
