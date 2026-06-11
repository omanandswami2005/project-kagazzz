/**
 * The standard agent prop set every interactive component accepts
 * (docs/design-system/component-library.md §Agent Interface,
 * agent-interface.md). Props propagate to data-agent-* attributes on the
 * rendered DOM root so voice, AI tool calls, computer-use agents, and E2E
 * tests can all drive the same surface.
 */

/** Semantic role of an element within its screen. */
export type AgentRole =
  | 'primary-action'
  | 'secondary-action'
  | 'destructive'
  | 'navigation';

/** Standard agent props (see component-library.md §The standard prop set). */
export interface AgentProps {
  /** Stable dot-separated id, module-prefixed (e.g. `vault.list.scan-btn`). */
  agentId?: string;
  /** Registered action id this element invokes when activated. */
  agentAction?: string;
  /** Role override (e.g. 'primary-action' for the screen's main CTA). */
  agentRole?: AgentRole;
}

/** data-agent-* attribute bag for spreading onto a DOM root. */
export interface AgentAttributes {
  'data-agent-id'?: string;
  'data-agent-action'?: string;
  'data-agent-role'?: AgentRole;
  'data-agent-state'?: string;
  'data-agent-value'?: string;
}

/**
 * Maps agent props (+ the component's derived state/value) to DOM
 * attributes. Undefined entries are omitted by React.
 */
export function agentAttrs(
  props: AgentProps,
  state?: string,
  value?: string
): AgentAttributes {
  return {
    'data-agent-id': props.agentId,
    'data-agent-action': props.agentAction,
    'data-agent-role': props.agentRole,
    'data-agent-state': state,
    'data-agent-value': value,
  };
}
