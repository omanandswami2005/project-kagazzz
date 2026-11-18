import { describe, expect, it } from 'vitest';
import { AI_TOOL_DESCRIPTORS } from '../../services/ai-tool-registry';
import { coreToolIds, getSkill, parseSkill, skillCatalog, SKILLS } from '../skill-registry';
import { matchSkills } from '../skill-router';
import { MAX_ACTIVE_SKILLS, SkillSession } from '../skill-session';

const ALL_IDS = AI_TOOL_DESCRIPTORS.map((d) => d.name);

describe('skill files (single source of truth invariants)', () => {
  it('loads all five skills', () => {
    expect(SKILLS.map((s) => s.name)).toEqual(['app-settings', 'document-search', 'image-tools', 'pdf-tools', 'text-extraction']);
  });

  it('every skill tool exists in the registry', () => {
    for (const skill of SKILLS) {
      for (const tool of skill.tools) {
        expect(ALL_IDS, `${skill.name} lists unknown tool ${tool}`).toContain(tool);
      }
    }
  });

  it('no tool belongs to two skills', () => {
    const all = SKILLS.flatMap((s) => s.tools);
    expect(new Set(all).size).toBe(all.length);
  });

  it('core tools are everything unclaimed, and always include list/search/loadSkill', () => {
    const core = coreToolIds(ALL_IDS);
    expect(core).toEqual(expect.arrayContaining(['ai.listDocuments', 'ai.searchDocuments', 'ai.loadSkill']));
    expect(core).not.toContain('ai.mergeDocuments');
    expect(core.length + SKILLS.flatMap((s) => s.tools).length).toBe(ALL_IDS.length);
  });

  it('each skill body stays small (~300 tokens) and has English and Hindi-or-English triggers', () => {
    for (const skill of SKILLS) {
      expect(skill.body.length, skill.name).toBeLessThan(1400);
      expect(skill.triggers.length, skill.name).toBeGreaterThan(3);
    }
  });

  it('the catalog names every skill', () => {
    const catalog = skillCatalog();
    SKILLS.forEach((s) => expect(catalog).toContain(`- ${s.name}:`));
  });
});

describe('parseSkill', () => {
  it('parses frontmatter lists and the body', () => {
    const s = parseSkill('---\nname: x\ndescription: d\ntriggers: A, B\ntools: t.one, t.two\n---\nRules here.\n');
    expect(s).toEqual({ name: 'x', description: 'd', triggers: ['a', 'b'], tools: ['t.one', 't.two'], body: 'Rules here.' });
  });

  it('rejects a missing frontmatter block or missing fields', () => {
    expect(() => parseSkill('no frontmatter')).toThrow('frontmatter');
    expect(() => parseSkill('---\nname: x\n---\nbody')).toThrow('needs name');
  });
});

describe('matchSkills (router)', () => {
  it.each([
    ['Merge my two PDFs', ['pdf-tools']],
    ['resize my photo to 200x230', ['image-tools']],
    ['switch to dark mode', ['app-settings']],
    ['पीडीएफ मर्ज करो', ['pdf-tools']],
    ['ऐप की भाषा हिंदी में बदल दो', ['app-settings']],
    ['merge the pdf and resize my photo', ['image-tools', 'pdf-tools']],
    ['namaste, what can you do?', []],
  ])('%s → %j', (message, expected) => {
    expect(matchSkills(message).sort()).toEqual(expected);
  });
});

describe('SkillSession', () => {
  it('starts with core tools only and adds a skill\'s tools when activated', () => {
    const session = new SkillSession(ALL_IDS);
    expect(session.isActive('ai.mergeDocuments')).toBe(false);
    expect(session.isActive('ai.listDocuments')).toBe(true);
    expect(session.activate(['pdf-tools'])).toBe(true);
    expect(session.isActive('ai.mergeDocuments')).toBe(true);
    expect(session.isActive('ai.resizeImage')).toBe(false);
  });

  it('reports no change when the skill is already active, and ignores unknown names', () => {
    const session = new SkillSession(ALL_IDS);
    session.activate(['pdf-tools']);
    expect(session.activate(['pdf-tools'])).toBe(false);
    expect(session.activate(['nope'])).toBe(false);
  });

  it('evicts the least recently used skill past the cap', () => {
    const session = new SkillSession(ALL_IDS);
    expect(SKILLS.length).toBeGreaterThan(MAX_ACTIVE_SKILLS);
    session.activate(['pdf-tools', 'image-tools', 'text-extraction']);
    session.activate(['pdf-tools']); // refresh: pdf is now most recent
    session.activate(['app-settings']); // evicts image-tools (oldest)
    expect(session.activeSkills().map((s) => s.name)).toEqual(['text-extraction', 'pdf-tools', 'app-settings']);
    expect(session.isActive('ai.resizeImage')).toBe(false);
  });

  it('keeps a stable tool order: core first, then skills in load order', () => {
    const session = new SkillSession(ALL_IDS);
    session.activate(['image-tools']);
    const ids = session.toolIds();
    expect(ids.indexOf('ai.listDocuments')).toBeLessThan(ids.indexOf('ai.resizeImage'));
    expect(getSkill('image-tools')?.tools[0]).toBe(ids[ids.length - getSkill('image-tools')!.tools.length]);
  });
});
