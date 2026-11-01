import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { FakeDb } from '@/test/fake-db';
import { useQuickReference } from '../useQuickReference';

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
const useDatabaseMock = vi.mocked(useDatabase);

const entryRow = {
  id: 'q-1',
  label: 'PAN No',
  value: 'ABCDE1234F',
  linked_document_id: null,
  is_secure: 1,
  created_at: '2026-07-18T00:00:00.000Z',
  updated_at: '2026-07-18T00:00:00.000Z',
};

const tagRow = {
  id: 't-1',
  name: 'finance',
  color: null,
  created_at: '2026-06-10T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useQuickReference (F-84)', () => {
  it('loads entries and groups tags by entry', async () => {
    const db = new FakeDb()
      .onQuery(/FROM quick_reference_entries WHERE is_secure/, [entryRow])
      .onQuery(/FROM quick_reference_tags qt\s+JOIN tags/, [
        { ...tagRow, entry_id: 'q-1' },
      ]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useQuickReference());
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.tagsByEntry.get('q-1')?.[0]?.name).toBe('finance');
  });

  it('createEntry trims label/value, inserts, and refreshes', async () => {
    const db = new FakeDb()
      .onQuery(/FROM quick_reference_entries WHERE is_secure/, [])
      .onQuery(/FROM quick_reference_tags qt\s+JOIN tags/, [])
      .onQuery(/FROM quick_reference_entries WHERE id/, [entryRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useQuickReference());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const entry = await result.current.createEntry('  PAN No  ', '  ABCDE1234F  ');
    expect(entry?.id).toBe('q-1');
    const insert = db.calls.find(
      (c) => c.kind === 'run' && c.sql.includes('INSERT INTO quick_reference_entries')
    );
    expect(insert?.params).toContain('PAN No'); // trimmed
    expect(insert?.params).toContain('ABCDE1234F'); // trimmed
  });

  it('createEntry returns null for a blank label or value', async () => {
    const db = new FakeDb()
      .onQuery(/FROM quick_reference_entries WHERE is_secure/, [])
      .onQuery(/FROM quick_reference_tags qt\s+JOIN tags/, []);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useQuickReference());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(await result.current.createEntry('  ', 'value')).toBeNull();
    expect(await result.current.createEntry('label', '  ')).toBeNull();
  });

  it('deleteEntry removes and refreshes; assignTag attaches', async () => {
    const db = new FakeDb()
      .onQuery(/FROM quick_reference_entries WHERE is_secure/, [entryRow])
      .onQuery(/FROM quick_reference_tags qt\s+JOIN tags/, []);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useQuickReference());
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    await result.current.deleteEntry('q-1');
    expect(
      db.calls.some((c) => c.sql.includes('DELETE FROM quick_reference_entries'))
    ).toBe(true);

    await result.current.assignTag('q-1', 't-1');
    expect(
      db.calls.some((c) => c.sql.includes('INSERT OR IGNORE INTO quick_reference_tags'))
    ).toBe(true);
  });

  it('isSecure=false loads and creates on the Quick Notes board', async () => {
    const noteRow = { ...entryRow, id: 'n-1', is_secure: 0 };
    const db = new FakeDb()
      .onQuery(/FROM quick_reference_entries WHERE is_secure/, [noteRow])
      .onQuery(/FROM quick_reference_tags qt\s+JOIN tags/, [])
      .onQuery(/FROM quick_reference_entries WHERE id/, [noteRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useQuickReference(false));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0]?.isSecure).toBe(false);

    // The read query is filtered to is_secure = 0.
    const readCall = db.calls.find((c) => c.sql.includes('WHERE is_secure'));
    expect(readCall?.params).toEqual([0]);

    await result.current.createEntry('Wi-Fi password', 'correcthorsebattery');
    const insert = db.calls.find(
      (c) => c.kind === 'run' && c.sql.includes('INSERT INTO quick_reference_entries')
    );
    expect(insert?.params).toContain(0); // isSecure stamped false
  });

  it('no-ops without a database', async () => {
    useDatabaseMock.mockReturnValue({ status: 'error', db: null });
    const { result } = renderHook(() => useQuickReference());
    await expect(result.current.createEntry('a', 'b')).resolves.toBeNull();
    await expect(result.current.deleteEntry('q-1')).resolves.toBeUndefined();
    await expect(result.current.assignTag('q-1', 't-1')).resolves.toBeUndefined();
  });
});
