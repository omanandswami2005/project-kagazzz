/**
 * Action Registry (docs/design-system/agent-interface.md §Layer 2).
 * The one typed list of every named action. Voice commands, AI tool
 * calls, computer-use agents, and E2E tests all invoke through here.
 */
import { z } from 'zod';
import type { ActionDefinition } from './define-action';
import type { ActionResult } from './types';

/** OpenAI-style tool definition consumed by WebLLM. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Central registry of {@link ActionDefinition}s. */
export class ActionRegistry<TCtx = unknown> {
  private readonly actions = new Map<
    string,
    ActionDefinition<z.ZodType, unknown, TCtx>
  >();

  /** Registers an action; duplicate ids are a programming error. */
  register(action: ActionDefinition<z.ZodType, unknown, TCtx>): this {
    if (this.actions.has(action.id)) {
      throw new Error(`Action "${action.id}" is already registered`);
    }
    this.actions.set(action.id, action);
    return this;
  }

  /** Registers every action in a module's action map. */
  registerAll(
    actions: Record<string, ActionDefinition<z.ZodType, unknown, TCtx>>
  ): this {
    for (const action of Object.values(actions)) {
      this.register(action);
    }
    return this;
  }

  /** Returns a registered action or undefined. */
  get(id: string): ActionDefinition<z.ZodType, unknown, TCtx> | undefined {
    return this.actions.get(id);
  }

  /** True when the id is registered. */
  has(id: string): boolean {
    return this.actions.has(id);
  }

  /** All registered actions. */
  list(): ActionDefinition<z.ZodType, unknown, TCtx>[] {
    return [...this.actions.values()];
  }

  /**
   * Validates args and runs the handler, mapping every failure mode into
   * the {@link ActionResult} envelope — agents never see exceptions.
   */
  async invoke(
    id: string,
    rawArgs: unknown,
    ctx: TCtx
  ): Promise<ActionResult<unknown>> {
    const action = this.actions.get(id);
    if (!action) {
      return {
        ok: false,
        code: 'AGENT_E_UNKNOWN_ACTION',
        message: `No action registered with id "${id}"`,
        retryable: false,
        userMessage: 'I cannot do that on this screen.',
      };
    }

    const parsed = action.args.safeParse(rawArgs);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'AGENT_E_INVALID_ARGS',
        message: parsed.error.message,
        retryable: false,
        userMessage: 'Something about that request was incomplete — please rephrase it.',
      };
    }

    try {
      const data = await action.handler(parsed.data, ctx);
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        code: 'AGENT_E_UNHANDLED',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
        userMessage: 'That did not work — please try again.',
      };
    }
  }

  /**
   * Emits the OpenAI/JSON-schema tool definitions the AI assistant
   * registers with WebLLM at startup (§Auto-generated tool definitions).
   * Dots become underscores in tool names per OpenAI naming rules.
   */
  toToolDefinitions(): Record<string, ToolDefinition> {
    const tools: Record<string, ToolDefinition> = {};
    for (const action of this.actions.values()) {
      tools[action.id] = {
        type: 'function',
        function: {
          name: action.id.replaceAll('.', '_'),
          description: action.summary,
          parameters: z.toJSONSchema(action.args),
        },
      };
    }
    return tools;
  }
}
