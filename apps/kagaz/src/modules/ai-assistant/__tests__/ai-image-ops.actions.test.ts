import { describe, expect, it, vi } from 'vitest';
import { aiImageOpsActions } from '../ai-image-ops.actions';
import { aiToolRegistry } from '../services/ai-tool-registry';
import type { AiToolContext } from '../ai-tools.actions';

describe('aiImageOpsActions', () => {
  it('resizeImage converts the KB budget to bytes and forwards the result', async () => {
    const resizeImage = vi
      .fn()
      .mockResolvedValue({ created: 1, resultSizeBytes: 40_000, hitQualityFloor: false });
    const out = await aiImageOpsActions.resizeImage.handler(
      { documentId: 'd-1', width: 200, height: 230, maxSizeKb: 50 },
      { resizeImage } as unknown as AiToolContext
    );
    expect(resizeImage).toHaveBeenCalledWith('d-1', 200, 230, 50 * 1024);
    expect(out.resultSizeBytes).toBe(40_000);
  });

  it('resizeImage rejects absurd dimensions and budgets', () => {
    const bad = aiImageOpsActions.resizeImage.args.safeParse({
      documentId: 'd',
      width: 1,
      height: 230,
      maxSizeKb: 0,
    });
    expect(bad.success).toBe(false);
  });

  it('enhanceImage only accepts known presets', async () => {
    expect(aiImageOpsActions.enhanceImage.args.safeParse({ documentId: 'd', preset: 'sepia' }).success).toBe(false);
    const enhanceImage = vi.fn().mockResolvedValue(1);
    const out = await aiImageOpsActions.enhanceImage.handler(
      { documentId: 'd-1', preset: 'bw' },
      { enhanceImage } as unknown as AiToolContext
    );
    expect(enhanceImage).toHaveBeenCalledWith('d-1', 'bw');
    expect(out).toEqual({ created: 1 });
  });

  it('runOcr returns only a character count, never text', async () => {
    const runOcr = vi.fn().mockResolvedValue(321);
    const out = await aiImageOpsActions.runOcr.handler(
      { documentId: 'd-1' },
      { runOcr } as unknown as AiToolContext
    );
    expect(out).toEqual({ characters: 321 });
  });

  it('is registered in the shared AI tool registry', () => {
    const ids = Object.keys(aiToolRegistry.toToolDefinitions());
    expect(ids).toEqual(expect.arrayContaining(['ai.resizeImage', 'ai.enhanceImage', 'ai.runOcr']));
  });
});
