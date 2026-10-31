import { describe, expect, it, vi } from 'vitest';
import { AI_TOOL_DESCRIPTORS } from '../../services/ai-tool-registry';
import { SkillController } from '../skill-controller';
import { SkillSession } from '../skill-session';

const make = (dynamic: boolean) => {
  const setActiveTools = vi.fn();
  const controller = new SkillController(
    new SkillSession(AI_TOOL_DESCRIPTORS.map((d) => d.name)),
    dynamic ? { setActiveTools } : {}
  );
  return { controller, setActiveTools };
};

describe('SkillController', () => {
  it('pre-loads a skill from the user message and pushes the tool set to the engine', () => {
    const { controller, setActiveTools } = make(true);
    controller.onUserMessage('please merge these pdfs');
    expect(setActiveTools).toHaveBeenCalledOnce();
    expect(setActiveTools.mock.calls[0][0]).toContain('ai.mergeDocuments');
    controller.onUserMessage('merge them again'); // already loaded: no churn (keeps the prompt cache)
    expect(setActiveTools).toHaveBeenCalledOnce();
  });

  it('refuses a tool whose skill is not loaded, then allows it after loadSkill', () => {
    const { controller } = make(true);
    expect(JSON.parse(controller.refusal('ai.resizeImage') ?? '{}')).toMatchObject({ ok: false });
    expect(controller.refusal('ai.listDocuments')).toBeNull();
    const loaded = controller.load('image-tools');
    expect(loaded.tools).toContain('ai.resizeImage');
    expect(controller.refusal('ai.resizeImage')).toBeNull();
  });

  it('never refuses on an engine with fixed tools (native LiteRT)', () => {
    const { controller } = make(false);
    expect(controller.refusal('ai.resizeImage')).toBeNull();
    expect(() => controller.sync()).not.toThrow();
  });

  it('load() rejects an unknown skill and lists the valid ones', () => {
    const { controller } = make(true);
    expect(() => controller.load('nope')).toThrow('Available: app-settings, document-search, image-tools, pdf-tools, text-extraction');
  });
});
