import type { ChatEngine } from '../services/chat-engine';
import { getSkill, SKILLS } from './skill-registry';
import { matchSkills } from './skill-router';
import type { SkillSession } from './skill-session';

/**
 * Connects a {@link SkillSession} to a chat engine: pre-loads skills from the
 * user's message, loads one on the model's request, pushes the active tool set
 * to the engine, and refuses tools whose skill isn't loaded. One place for the
 * glue so `useChat` and the live tests behave identically.
 */
export class SkillController {
  constructor(
    private readonly session: SkillSession,
    private readonly engine: Pick<ChatEngine, 'setActiveTools'>
  ) {}

  /** Sends the current tool set to the engine (a no-op for engines that fix their tools up front). */
  sync(): void {
    this.engine.setActiveTools?.(this.session.toolIds());
  }

  /** Router pre-activation, called before each user message is sent. */
  onUserMessage(text: string): void {
    if (this.session.activate(matchSkills(text))) {
      this.sync();
    }
  }

  /** Model-driven load (`ai.loadSkill`). */
  load(name: string): { loaded: string; tools: string[]; rules: string; next: string } {
    const skill = getSkill(name);
    if (!skill) {
      throw new Error(`Unknown skill "${name}". Available: ${SKILLS.map((s) => s.name).join(', ')}`);
    }
    this.session.activate([name]);
    this.sync();
    return {
      loaded: skill.name,
      tools: skill.tools,
      rules: skill.body,
      // Models tend to stop and chat after a "load" call; say plainly that the request is not finished.
      next: "The skill is loaded. Now carry out the user's original request with these tools: search for the documents yourself, then call the action — do not ask the user anything you can look up.",
    };
  }

  /** A JSON error for a tool the model may not call yet, or null when it is allowed. */
  refusal(toolId: string): string | null {
    if (!this.engine.setActiveTools || this.session.isActive(toolId)) {
      return null;
    }
    return JSON.stringify({
      ok: false,
      error: `Tool ${toolId} is not loaded. Call ai.loadSkill with the skill that provides it first.`,
    });
  }
}
