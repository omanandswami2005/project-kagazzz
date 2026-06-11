import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ActionRegistry } from '../action-registry';
import { defineAction } from '../define-action';

interface Ctx {
  log: string[];
}

function uploadAction(handler = vi.fn(async () => 'uploaded')) {
  return defineAction<z.ZodType, unknown, Ctx>({
    id: 'vault.uploadDocument',
    summary: 'Upload a document.',
    args: z.object({ source: z.enum(['camera', 'gallery']).optional() }),
    requiresConfirmation: false,
    handler,
  });
}

describe('ActionRegistry', () => {
  it('registers, gets, lists, and rejects duplicates', () => {
    const registry = new ActionRegistry<Ctx>();
    const action = uploadAction();
    registry.register(action);
    expect(registry.has('vault.uploadDocument')).toBe(true);
    expect(registry.get('vault.uploadDocument')).toBe(action);
    expect(registry.list()).toHaveLength(1);
    expect(() => registry.register(action)).toThrow('already registered');
  });

  it('registerAll registers a module action map', () => {
    const registry = new ActionRegistry<Ctx>().registerAll({
      upload: uploadAction(),
    });
    expect(registry.has('vault.uploadDocument')).toBe(true);
  });

  it('invoke validates args and runs the handler', async () => {
    const handler = vi.fn(async () => 'uploaded');
    const registry = new ActionRegistry<Ctx>().register(uploadAction(handler));
    const result = await registry.invoke(
      'vault.uploadDocument',
      { source: 'camera' },
      { log: [] }
    );
    expect(result).toEqual({ ok: true, data: 'uploaded' });
    expect(handler).toHaveBeenCalledWith({ source: 'camera' }, { log: [] });
  });

  it('invoke maps unknown actions to AGENT_E_UNKNOWN_ACTION', async () => {
    const registry = new ActionRegistry<Ctx>();
    const result = await registry.invoke('nope.doThing', {}, { log: [] });
    expect(result).toMatchObject({
      ok: false,
      code: 'AGENT_E_UNKNOWN_ACTION',
      retryable: false,
    });
  });

  it('invoke maps invalid args to AGENT_E_INVALID_ARGS without running the handler', async () => {
    const handler = vi.fn(async () => 'uploaded');
    const registry = new ActionRegistry<Ctx>().register(uploadAction(handler));
    const result = await registry.invoke(
      'vault.uploadDocument',
      { source: 'bluetooth' },
      { log: [] }
    );
    expect(result).toMatchObject({ ok: false, code: 'AGENT_E_INVALID_ARGS' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('invoke maps handler throws to AGENT_E_UNHANDLED with a user message', async () => {
    const registry = new ActionRegistry<Ctx>().register(
      uploadAction(vi.fn().mockRejectedValue(new Error('disk full')))
    );
    const result = await registry.invoke('vault.uploadDocument', {}, { log: [] });
    expect(result).toMatchObject({
      ok: false,
      code: 'AGENT_E_UNHANDLED',
      message: 'disk full',
    });
    if (!result.ok) {
      expect(result.userMessage.length).toBeGreaterThan(0);
    }
  });

  it('toToolDefinitions emits OpenAI-style tools with JSON-schema params', () => {
    const registry = new ActionRegistry<Ctx>().register(uploadAction());
    const tools = registry.toToolDefinitions();
    const tool = tools['vault.uploadDocument'];
    expect(tool?.type).toBe('function');
    expect(tool?.function.name).toBe('vault_uploadDocument');
    expect(tool?.function.description).toBe('Upload a document.');
    expect(tool?.function.parameters).toMatchObject({ type: 'object' });
  });
});
