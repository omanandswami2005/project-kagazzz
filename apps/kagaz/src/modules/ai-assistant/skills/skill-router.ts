import { SKILLS, type Skill } from './skill-registry';

/**
 * Deterministic pre-activation: which skills does this user message suggest?
 * No model call, so no extra round trip. Substring match on lower-cased trigger
 * words — Hindi has no reliable word boundaries — which errs toward loading a
 * skill a little too eagerly; the session cap and `ai.loadSkill` cover the rest.
 */
export function matchSkills(message: string, skills: Skill[] = SKILLS): string[] {
  const text = message.toLowerCase();
  return skills.filter((s) => s.triggers.some((t) => text.includes(t))).map((s) => s.name);
}
