import { describe, expect, it, vi } from 'vitest';
import { aiAskUserActions, END_TURN_TOOLS } from '../ai-ask-user.actions';
import type { AiToolContext } from '../ai-tools.actions';
import { aiToolRegistry } from '../services/ai-tool-registry';

describe('ai.askUser', () => {
  const spec = { question: 'Resize how?', fields: [{ id: 'width', label: 'Width', type: 'number' as const, required: true }] };

  it('hands the validated form to the context and reports that it is waiting for the user', async () => {
    const askUser = vi.fn().mockReturnValue({ status: 'waiting_for_user' });
    const out = await aiAskUserActions.askUser.handler(spec, { askUser } as unknown as AiToolContext);
    expect(askUser).toHaveBeenCalledWith(spec);
    expect(out).toEqual({ status: 'waiting_for_user' });
  });

  it('a throwing context (e.g. a sensitive request) becomes an error result the model can read', async () => {
    const askUser = vi.fn(() => {
      throw new Error('Do not ask for passwords');
    });
    const result = await aiToolRegistry.invoke('ai.askUser', spec, { askUser } as unknown as AiToolContext);
    expect(result.ok).toBe(false);
  });

  it('is a core tool that ends the model turn', () => {
    expect(END_TURN_TOOLS).toContain('ai.askUser');
    expect(aiToolRegistry.has('ai.askUser')).toBe(true);
  });

  it('exposes a JSON schema the model can fill: question + 1-3 typed fields with bounds', () => {
    const def = aiToolRegistry.toToolDefinitions()['ai.askUser'];
    const params = def.function.parameters as { properties: { question: { maxLength: number }; fields: { minItems: number; maxItems: number; items: { properties: Record<string, unknown>; required: string[] } } } };
    expect(params.properties.question.maxLength).toBe(300);
    expect(params.properties.fields.minItems).toBe(1);
    expect(params.properties.fields.maxItems).toBe(3);
    expect(Object.keys(params.properties.fields.items.properties)).toEqual(
      expect.arrayContaining(['id', 'label', 'type', 'options', 'min', 'max', 'unit', 'kinds'])
    );
    expect(params.properties.fields.items.required).toEqual(expect.arrayContaining(['id', 'label', 'type']));
  });
});
