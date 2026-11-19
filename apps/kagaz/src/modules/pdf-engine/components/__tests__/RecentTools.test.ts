import { describe, expect, it } from 'vitest';
import type { ResolvedToolRun } from '../../hooks/useToolHistory';
import { recentTools } from '../RecentTools';

const run = (toolId: string, status: 'completed' | 'failed', inputs: [string, boolean][]): ResolvedToolRun =>
  ({
    run: { id: `${toolId}-${status}`, toolId, status },
    inputs: inputs.map(([id, live]) => ({ id, doc: live ? { id } : null })),
    outputs: [],
  }) as unknown as ResolvedToolRun;

describe('recentTools (PT-5)', () => {
  it('keeps the latest distinct successful tools with their last live input', () => {
    expect(
      recentTools([
        run('compress', 'completed', [['gone', false], ['d1', true]]),
        run('merge', 'failed', [['d2', true]]),
        run('compress', 'completed', [['d3', true]]),
        run('split', 'completed', [['d4', true]]),
        run('merge', 'completed', [['d5', true]]),
        run('watermark', 'completed', [['d6', true]]),
      ])
    ).toEqual([
      { op: 'compress', documentId: 'd1' },
      { op: 'split', documentId: 'd4' },
      { op: 'merge', documentId: 'd5' },
    ]);
  });
});
