import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import type { DocumentEntity, ToolRunEntity } from '@/infrastructure/database/types';
import type { ResolvedToolRun } from '../../hooks/useToolHistory';

const { entries, clear } = vi.hoisted(() => ({ entries: [] as ResolvedToolRun[], clear: vi.fn() }));
vi.mock('../../hooks/useToolHistory', () => ({
  useToolHistory: () => ({ entries, loading: false, clear }),
}));
vi.mock('@/core/hooks/useThumbnail', () => ({ useThumbnail: () => null }));

import { ToolHistoryList } from '../ToolHistoryList';

const doc = (id: string, name: string): DocumentEntity =>
  ({ id, name, fileType: 'pdf', isLocked: false }) as DocumentEntity;
const run = (over: Partial<ToolRunEntity>): ToolRunEntity => ({
  id: 'r1',
  toolId: 'merge',
  inputDocumentIds: [],
  outputDocumentIds: [],
  status: 'completed',
  createdAt: '2026-11-19T10:00:00.000Z',
  ...over,
});

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('ToolHistoryList', () => {
  it('shows the empty state', () => {
    entries.length = 0;
    render(<ToolHistoryList onOpen={vi.fn()} />);
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  });

  it('lists inputs, opens a created document, and marks a deleted one', () => {
    entries.length = 0;
    const merged = doc('m', 'Merged document');
    entries.push({
      run: run({}),
      inputs: [{ id: 'a', doc: doc('a', 'PAN') }, { id: 'b', doc: null }],
      outputs: [{ id: 'm', doc: merged }, { id: 'x', doc: null }],
    });
    const onOpen = vi.fn();
    render(<ToolHistoryList onOpen={onOpen} clearable />);
    expect(screen.getByText('From PAN, Deleted document')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Merged document'));
    expect(onOpen).toHaveBeenCalledWith(merged);
    expect(screen.getAllByText('Deleted document')).toHaveLength(1);
    fireEvent.click(screen.getByText('Clear history'));
    expect(clear).toHaveBeenCalled();
  });

  it('shows a failed run without outputs', () => {
    entries.length = 0;
    entries.push({ run: run({ status: 'failed' }), inputs: [], outputs: [] });
    render(<ToolHistoryList toolId="merge" onOpen={vi.fn()} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
