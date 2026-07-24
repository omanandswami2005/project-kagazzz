/**
 * The AI chat's Action Registry instance (F-14, 05-ai-assistant-module.md
 * §4) — one process-wide registration of ai-tools.actions.ts's actions,
 * built once at module load since the tool set itself is static (unlike
 * the `ctx` each invocation needs, which useChat builds per-conversation
 * from live DAOs).
 */
import { ActionRegistry, type ToolDefinition } from '@kagaz/agent-kit';
import type { ToolDescriptor } from '@kagaz/capacitor-llm-litert';
import { aiToolActions, type AiToolContext } from '../ai-tools.actions';

/** Registered once — see the module doc comment for why this is a singleton. */
export const aiToolRegistry = new ActionRegistry<AiToolContext>().registerAll(aiToolActions);

/**
 * Converts a registry {@link ToolDefinition} into the native bridge's
 * {@link ToolDescriptor} shape (`descriptionJson` is what
 * `OpenApiTool.getToolDescriptionJsonString()` returns on the native side
 * — see JsBridgeTool.java). The action's OWN dotted id (`ai.listDocuments`)
 * is what the tool is registered and dispatched under everywhere in this
 * app — including here — so the model is told to call that name, not
 * `toToolDefinitions()`'s underscored `function.name` (which exists only
 * for OpenAI naming-rule compatibility, a constraint LiteRT-LM doesn't
 * share).
 */
function toToolDescriptor(id: string, tool: ToolDefinition): ToolDescriptor {
  return {
    name: id,
    descriptionJson: JSON.stringify({ ...tool.function, name: id }),
  };
}

/** Every AI tool, ready to pass to `AIProvider.activate()` / `setModel({ tools })`. */
export const AI_TOOL_DESCRIPTORS: ToolDescriptor[] = Object.entries(
  aiToolRegistry.toToolDefinitions()
).map(([id, tool]) => toToolDescriptor(id, tool));
