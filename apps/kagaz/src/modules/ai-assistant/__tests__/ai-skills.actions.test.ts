import { describe, expect, it, vi } from 'vitest';
import { aiSkillActions } from '../ai-skills.actions';
import type { AiToolContext } from '../ai-tools.actions';

describe('aiSkillActions.loadSkill', () => {
  it('forwards the skill name and returns its tools and rules', async () => {
    const loadSkill = vi.fn().mockReturnValue({ loaded: 'pdf-tools', tools: ['ai.mergeDocuments'], rules: 'r' });
    const out = await aiSkillActions.loadSkill.handler({ name: 'pdf-tools' }, { loadSkill } as unknown as AiToolContext);
    expect(loadSkill).toHaveBeenCalledWith('pdf-tools');
    expect(out.tools).toEqual(['ai.mergeDocuments']);
  });

  it('turns a thrown unknown-skill error into a rejection (becomes an ActionResult error)', async () => {
    const loadSkill = vi.fn(() => {
      throw new Error('Unknown skill');
    });
    await expect(
      aiSkillActions.loadSkill.handler({ name: 'x' }, { loadSkill } as unknown as AiToolContext)
    ).rejects.toThrow('Unknown skill');
  });
});
