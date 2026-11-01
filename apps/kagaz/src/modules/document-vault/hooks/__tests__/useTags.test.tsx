import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { useTags } from '../useTags';
import { useTagsStore } from '../../store/tags.store';

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
  // Bug-audit fix: tags now live in a shared store (not per-hook-instance
  // state), so it must be reset between tests same as vault.store.ts.
  useTagsStore.setState({ tags: [], tagsByDocument: new Map() });
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

  it('bug-audit fix: two independent hook instances (different pages) see the same tag snapshot', async () => {
    const db = new FakeDb()
      .onQuery(/SELECT \* FROM tags ORDER BY name/, [])
      .onQuery(/FROM document_tags dt\s+JOIN tags/, []);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    // Two separate renderHook calls = two independent useTags() call
    // sites, exactly like VaultHomePage and FavoritesPage each calling it.
    const pageA = renderHook(() => useTags());
    const pageB = renderHook(() => useTags());
    await waitFor(() => expect(pageA.result.current.tags).toEqual([]));
    await waitFor(() => expect(pageB.result.current.tags).toEqual([]));

    // Whatever refreshes the shared store (a real createTag/assignTag call
    // on either instance funnels here via setSnapshot) — page A's own
    // refresh landing in the ONE shared store, not a copy only it can see.
    act(() => {
      useTagsStore
        .getState()
        .setSnapshot(
          [{ id: 't-1', name: 'urgent', color: '#ef4444', createdAt: tagRow.created_at }],
          new Map()
        );
    });

    // ...is visible from page B's instance without page B doing anything,
    // unlike the pre-fix per-instance useState (which would leave page B
    // stale until it remounted).
    expect(pageB.result.current.tags).toHaveLength(1);
    expect(pageB.result.current.tags[0]?.name).toBe('urgent');
    // And page A sees the exact same object (one store, not two copies).
    expect(pageA.result.current.tags).toBe(pageB.result.current.tags);
  });

  it('no-ops without a database', async () => {
    useDatabaseMock.mockReturnValue({ status: 'error', db: null });
    const { result } = renderHook(() => useTags());
    await expect(result.current.createTag('x')).resolves.toBeNull();
    await expect(result.current.assignTag('d', 't')).resolves.toBeUndefined();
  });
});
