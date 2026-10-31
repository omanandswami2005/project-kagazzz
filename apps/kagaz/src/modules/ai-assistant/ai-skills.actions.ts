/**
 * `ai.loadSkill` — the model-driven way to load a skill when the app's
 * keyword router didn't (05-ai-assistant-module.md §3.7). Always a core tool.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { AiToolContext } from './ai-tools.actions';

export const aiSkillActions = {
  loadSkill: defineAction({
    id: 'ai.loadSkill',
    summary:
      'Load a skill: makes its tools available and returns its usage rules. Call this when you need tools that are not in your tool list.',
    args: z.object({ name: z.string().min(1) }),
    requiresConfirmation: false,
    handler: (
      args: { name: string },
      ctx: AiToolContext
    ): Promise<{ loaded: string; tools: string[]; rules: string; next: string }> =>
      // Via a promise so an unknown-skill throw becomes an ActionResult error, not a sync exception.
      Promise.resolve().then(() => ctx.loadSkill(args.name)),
  }),
};
