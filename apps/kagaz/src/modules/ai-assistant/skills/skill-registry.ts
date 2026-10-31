/**
 * Skills (05-ai-assistant-module.md §3.7): groups of AI tools plus short usage
 * rules, loaded on demand so a PDF-only chat doesn't pay prompt tokens for
 * image or settings tools. Each skill is one `*.skill.md` file here — a
 * frontmatter block (name, description, trigger words in English + Hindi, the
 * tool ids it unlocks) and a body of rules that `ai.loadSkill` hands the model.
 *
 * Core tools are *derived*: every registry action not claimed by a skill. That
 * keeps one source of truth (the action definitions) — skill-registry.test.ts
 * enforces that no tool is in two skills and every listed tool exists.
 */

export interface Skill {
  name: string;
  description: string;
  /** Lower-cased words/phrases that suggest the skill (English + Hindi). */
  triggers: string[];
  /** Action ids this skill unlocks. */
  tools: string[];
  /** Usage rules returned to the model by `ai.loadSkill`. */
  body: string;
}

const list = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Parses one skill file; throws a clear error on a malformed one. */
export function parseSkill(raw: string, source = 'skill'): Skill {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw.replace(/\r\n/g, '\n'));
  if (!match) {
    throw new Error(`${source}: missing frontmatter block`);
  }
  const fields = new Map<string, string>();
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) {
      fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
    }
  }
  const name = fields.get('name');
  const description = fields.get('description');
  const tools = list(fields.get('tools') ?? '');
  if (!name || !description || tools.length === 0) {
    throw new Error(`${source}: needs name, description and at least one tool`);
  }
  return {
    name,
    description,
    triggers: list(fields.get('triggers') ?? '').map((t) => t.toLowerCase()),
    tools,
    body: match[2].trim(),
  };
}

const files = import.meta.glob<string>('./*.skill.md', { query: '?raw', import: 'default', eager: true });

export const SKILLS: Skill[] = Object.entries(files)
  .map(([path, raw]) => parseSkill(raw, path))
  .sort((a, b) => a.name.localeCompare(b.name));

export function getSkill(name: string): Skill | undefined {
  return SKILLS.find((s) => s.name === name);
}

/** Every registry id no skill claims — always sent to the model. */
export function coreToolIds(allToolIds: string[], skills: Skill[] = SKILLS): string[] {
  const claimed = new Set(skills.flatMap((s) => s.tools));
  return allToolIds.filter((id) => !claimed.has(id));
}

/** One line per skill for the system prompt, so the model knows what it can load. */
export function skillCatalog(skills: Skill[] = SKILLS): string {
  return [
    'You do NOT have the tools below yet. They are grouped into skills and appear only after you load the skill. When the user asks for something one of these skills covers, call ai.loadSkill with that skill name FIRST (before replying or asking anything), then use its tools:',
    ...skills.map((s) => `- ${s.name}: ${s.description}`),
  ].join('\n');
}
