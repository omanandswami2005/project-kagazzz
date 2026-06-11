/**
 * Shared agent-surface types
 * (docs/design-system/agent-interface.md §Layer 1, §Failure & recovery).
 */

/**
 * The fixed data-agent-state vocabulary (§State vocabulary + the form
 * field states from §Form-filling protocol). No custom values without an
 * RFC against agent-interface.md.
 */
export const AGENT_STATES = [
  'idle',
  'hover',
  'focus',
  'pressed',
  'loading',
  'success',
  'error',
  'disabled',
  'selected',
  'expanded',
  'collapsed',
  'dirty',
  'pristine',
  // form-field states (§Field-level state)
  'autofilled',
  'valid',
  'submitting',
] as const;

/** One of the fixed agent states. */
export type AgentState = (typeof AGENT_STATES)[number];

/** Semantic role of an element beyond ARIA. */
export type AgentRole =
  | 'primary-action'
  | 'secondary-action'
  | 'destructive'
  | 'navigation';

/**
 * Machine-readable error code, SCREAMING_SNAKE namespaced by module
 * (e.g. VAULT_E_FILE_TOO_LARGE).
 */
export type ActionErrorCode = string;

/** Failure half of an {@link ActionResult}. */
export interface ActionError {
  ok: false;
  code: ActionErrorCode;
  /** Developer-facing message (logs, never UI). */
  message: string;
  /** Agent may retry without asking the user when true. */
  retryable: boolean;
  /** Plain-language, locale-ready text the assistant says to the user. */
  userMessage: string;
}

/**
 * Result envelope every action invocation resolves to
 * (§Failure & recovery semantics). Handlers never throw across the agent
 * boundary.
 */
export type ActionResult<T> = { ok: true; data: T } | ActionError;
