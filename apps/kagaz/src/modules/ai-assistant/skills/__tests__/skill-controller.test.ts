import { describe, expect, it, vi } from 'vitest';
import { AI_TOOL_DESCRIPTORS } from '../../services/ai-tool-registry';
import { SkillController } from '../skill-controller';
import { SkillSession } from '../skill-session';

const make = () => {
  const setToolSubset = vi.fn();
  const controller = new SkillController(new SkillSession(AI_TOOL_DESCRIPTORS.map((d) => d.name)), {
    setToolSubset,
  });
  return { controller, setToolSubset };
};

describe('SkillController (native tool subset)', () => {
  it('shows every tool until a skill matches, then only core + that skill', () => {
    const { controller, setToolSubset } = make();
    controller.sync();
    expect(setToolSubset).toHaveBeenLastCalledWith(null); // no skill: all tools

    controller.onUserMessage('please merge these pdfs');
    const subset = setToolSubset.mock.calls.at(-1)?.[0] as string[];
    expect(subset).toContain('ai.mergeDocuments');
    expect(subset).toContain('ai.listDocuments'); // core stays
    expect(subset).not.toContain('ai.resizeImage'); // other skills are hidden
  });

  it('does not rebuild the conversation when the matched skill is already loaded', () => {
    const { controller, setToolSubset } = make();
    controller.onUserMessage('please merge these pdfs');
    const calls = setToolSubset.mock.calls.length;
    controller.onUserMessage('merge them again');
    expect(setToolSubset.mock.calls.length).toBe(calls);
  });

  it('load() returns the skill tools and rules', () => {
    const { controller } = make();
    const loaded = controller.load('image-tools');
    expect(loaded.tools).toContain('ai.resizeImage');
    expect(loaded.rules.length).toBeGreaterThan(0);
  });

  it('load() rejects an unknown skill and lists the valid ones', () => {
    const { controller } = make();
    expect(() => controller.load('nope')).toThrow(
      'Available: app-settings, document-search, image-tools, pdf-tools, text-extraction'
    );
  });

  it('works with an engine that has no setToolSubset', () => {
    const controller = new SkillController(new SkillSession(AI_TOOL_DESCRIPTORS.map((d) => d.name)), {});
    expect(() => controller.sync()).not.toThrow();
  });
});
