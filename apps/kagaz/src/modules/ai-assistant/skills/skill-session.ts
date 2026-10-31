import { getSkill, SKILLS, type Skill } from './skill-registry';

/** Most skills kept loaded at once — each one grows the prompt, and a changed tool list invalidates the engine's prompt cache. */
export const MAX_ACTIVE_SKILLS = 3;

/**
 * The skills loaded in one chat. Sticky across turns (switching tools every
 * message would defeat prompt caching); least-recently-used is evicted past the cap.
 */
export class SkillSession {
  private active: string[] = [];

  constructor(
    private readonly allToolIds: string[],
    private readonly skills: Skill[] = SKILLS
  ) {}

  /** Loads (or refreshes) skills; returns true if the set of active tools changed. */
  activate(names: string[]): boolean {
    const before = this.toolIds().join();
    for (const name of names) {
      if (!this.skills.some((s) => s.name === name)) {
        continue;
      }
      this.active = [...this.active.filter((n) => n !== name), name];
    }
    this.active = this.active.slice(-MAX_ACTIVE_SKILLS);
    return this.toolIds().join() !== before;
  }

  activeSkills(): Skill[] {
    return this.active.map((n) => getSkill(n)).filter((s): s is Skill => s !== undefined);
  }

  /** Core tools first, then each active skill's tools, in a stable order (keeps the prompt prefix steady). */
  toolIds(): string[] {
    const claimed = new Set(this.skills.flatMap((s) => s.tools));
    const core = this.allToolIds.filter((id) => !claimed.has(id));
    return [...core, ...this.active.flatMap((n) => this.skills.find((s) => s.name === n)?.tools ?? [])];
  }

  isActive(toolId: string): boolean {
    return this.toolIds().includes(toolId);
  }
}
