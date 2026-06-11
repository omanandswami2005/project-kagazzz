/**
 * useAgentProps — Layer 1 boilerplate killer
 * (docs/design-system/agent-interface.md §Helper).
 * Returns the data-agent-* attribute bag for a DOM root and, in dev,
 * emits `agent:render` so the AgentInspector can show the live graph.
 */
import { useEffect } from 'react';
import type { AgentRole, AgentState } from './types';

/** Input to {@link useAgentProps}. */
export interface UseAgentPropsInput {
  /** Stable agent id (`{module}.{surface}-{element}`). */
  id: string;
  /** Registered action id this element invokes. */
  action?: string;
  /** Semantic role beyond ARIA. */
  role?: AgentRole;
  /** Current state from the fixed vocabulary. */
  state?: AgentState;
  /** Current value (form fields; omit for passwords). */
  value?: string;
}

/** The data-agent-* attribute bag. */
export interface UseAgentPropsResult {
  'data-agent-id': string;
  'data-agent-action'?: string;
  'data-agent-role'?: AgentRole;
  'data-agent-state'?: AgentState;
  'data-agent-value'?: string;
}

declare const process: { env?: Record<string, string | undefined> } | undefined;

function isDev(): boolean {
  return (
    typeof process !== 'undefined' &&
    process?.env?.['NODE_ENV'] !== 'production'
  );
}

/**
 * Computes the data-agent-* props for an interactive element.
 * Dev builds dispatch `agent:render` (CustomEvent) on each commit so the
 * AgentInspector overlay can track the agent graph live.
 */
export function useAgentProps(input: UseAgentPropsInput): UseAgentPropsResult {
  const { id, action, role, state, value } = input;

  useEffect(() => {
    if (isDev() && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('agent:render', {
          detail: { id, action, role, state, value },
        })
      );
    }
  }, [id, action, role, state, value]);

  return {
    'data-agent-id': id,
    'data-agent-action': action,
    'data-agent-role': role,
    'data-agent-state': state,
    'data-agent-value': value,
  };
}
