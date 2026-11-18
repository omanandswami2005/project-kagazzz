import type { ChatEngine } from '../services/chat-engine';
import { getSkill, SKILLS } from './skill-registry';
import { matchSkills } from './skill-router';
import type { SkillSession } from './skill-session';

/**
 * Connects a {@link SkillSession} to a chat engine: pre-loads skills from the
 * user's message, loads one on the model's request, and narrows the tools the
 * native engine shows the model to core + the loaded skills. The model simply
 * isn't shown other tools, so nothing has to be refused at call time.
 */
export class SkillController {
  constructor(
    private readonly session: SkillSession,
    private readonly engine: Pick<ChatEngine, 'setToolSubset'>
  ) {}

  /** Sends the current tool set to the engine. */
  sync(): void {
    // Native engine: with a skill loaded, show the model only core + that skill's tools; with none, all of them.
    this.engine.setToolSubset?.(
      this.session.activeSkills().length > 0 ? this.session.toolIds() : null
    );
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
      throw new Error(
        `Unknown skill "${name}". Available: ${SKILLS.map((s) => s.name).join(', ')}`
      );
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
}
