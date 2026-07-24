/**
 * defineAction — the single way actions enter the registry
 * (docs/design-system/agent-interface.md §Layer 2).
 * One Zod schema validates chat input, generates the on-device AI
 * assistant's tool definition (LiteRT-LM, F-13), validates remote
 * payloads (V2), and drives E2E tests.
 */
import type { z } from 'zod';

/** Action id: lowercase module prefix + dot-separated name segments. */
const ACTION_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*)+$/;

/** Configuration accepted by {@link defineAction}. */
export interface ActionConfig<
  TArgs extends z.ZodType,
  TResult,
  TCtx,
> {
  /** Public, stable action id (e.g. `vault.uploadDocument`). */
  id: string;
  /** One-line description — becomes the LLM tool description. */
  summary: string;
  /** Voice trigger phrases (en + hi), matched by the assistant. */
  voice?: string[];
  /** Zod schema for the action's arguments. */
  args: TArgs;
  /**
   * Whether the in-chat confirmation card must be shown first.
   * Policy (§Confirmation policy): true ONLY for actions without undo.
   */
  requiresConfirmation: boolean;
  /** Executes the action. Must not be called with unvalidated args. */
  handler: (args: z.infer<TArgs>, ctx: TCtx) => Promise<TResult>;
}

/** A registered action definition. */
export type ActionDefinition<
  TArgs extends z.ZodType = z.ZodType,
  TResult = unknown,
  TCtx = never,
> = Readonly<ActionConfig<TArgs, TResult, TCtx>>;

/** Map of local action names to their definitions (one per module). */
export type ActionMap = Record<string, ActionDefinition>;

/**
 * Declares a named action. Validates the id format at module-init time so
 * a malformed id fails the build/test run, never an agent at runtime.
 */
export function defineAction<TArgs extends z.ZodType, TResult, TCtx>(
  config: ActionConfig<TArgs, TResult, TCtx>
): ActionDefinition<TArgs, TResult, TCtx> {
  if (!ACTION_ID_PATTERN.test(config.id)) {
    throw new Error(
      `Invalid action id "${config.id}" — expected {module}.{name} in ` +
        'lowercase module prefix + camelCase segments (agent-interface.md §Naming)'
    );
  }
  if (!config.summary.trim()) {
    throw new Error(`Action "${config.id}" needs a non-empty summary`);
  }
  return Object.freeze({ ...config });
}
