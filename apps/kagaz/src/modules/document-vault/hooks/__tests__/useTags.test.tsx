import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { useTags } from '../useTags';

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
const useDatabaseMock = vi.mocked(useDatabase);

const tagRow = {
  id: 't-1',
  name: 'urgent',
  color: '#ef4444',
  created_at: '2026-06-10T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTags (F-10)', () => {
  it('loads tags and groups assignments by document', async () => {
    const db = new FakeDb()
      .onQuery(/SELECT \* FROM tags ORDER BY name/, [tagRow])
      .onQuery(/FROM document_tags dt\s+JOIN tags/, [
        { ...tagRow, document_id: 'doc-1' },
      ]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(1));
    expect(result.current.tagsByDocument.get('doc-1')?.[0]?.name).toBe('urgent');
  });

  it('createTag inserts, assignTag attaches, and both refresh', async () => {
    const db = new FakeDb()
      .onQuery(/SELECT \* FROM tags ORDER BY name/, [])
      .onQuery(/FROM document_tags dt\s+JOIN tags/, [])
      .onQuery(/FROM tags WHERE id/, [tagRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useTags());
    await waitFor(() => expect(result.current.tags).toEqual([]));

    const tag = await result.current.createTag('  urgent  ');
    expect(tag?.id).toBe('t-1');
    const insert = db.calls.find(
      (c) => c.kind === 'run' && c.sql.includes('INSERT INTO tags')
    );
    expect(insert?.params).toContain('urgent'); // trimmed

    await result.current.assignTag('doc-1', 't-1');
    expect(
      db.calls.some((c) => c.sql.includes('INSERT OR IGNORE INTO document_tags'))
    ).toBe(true);
  });

  it('no-ops without a database', async () => {
    useDatabaseMock.mockReturnValue({ status: 'error', db: null });
    const { result } = renderHook(() => useTags());
    await expect(result.current.createTag('x')).resolves.toBeNull();
    await expect(result.current.assignTag('d', 't')).resolves.toBeUndefined();
  });
});
