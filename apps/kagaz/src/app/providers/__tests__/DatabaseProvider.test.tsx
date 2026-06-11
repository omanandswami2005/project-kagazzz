import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDiagnosticSink, type LogRecord } from '@/core/logging';
import { cleanupTempFiles } from '@/infrastructure/filesystem';
import { FakeDb } from '@/test/fake-db';
import { DatabaseProvider, useDatabase } from '../DatabaseProvider';

vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: vi.fn(() => ({ clearDirectory: vi.fn() })),
  cleanupTempFiles: vi.fn(async () => undefined),
}));

function Probe(): React.ReactNode {
  const { status } = useDatabase();
  return <span data-testid="status">{status}</span>;
}

afterEach(() => {
  setDiagnosticSink(null);
  vi.clearAllMocks();
});

describe('DatabaseProvider (bootstrap sequence)', () => {
  it('opens the DB, wires the log sink, wipes temp/, reports ready', async () => {
    const db = new FakeDb();
    const open = vi.fn(async () => db);
    render(
      <DatabaseProvider open={open}>
        <Probe />
      </DatabaseProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    );
    expect(open).toHaveBeenCalledOnce();
    expect(cleanupTempFiles).toHaveBeenCalledOnce();
    // Sink is attached: prune ran against app_logs.
    expect(db.allSql).toContain('DELETE FROM app_logs WHERE time < ?');
  });

  it('reports error (and logs fatal) when the DB cannot open', async () => {
    const records: LogRecord[] = [];
    setDiagnosticSink({ write: (r) => records.push(r) });
    const open = vi.fn(async () => {
      throw new Error('cipher key rejected');
    });
    render(
      <DatabaseProvider open={open}>
        <Probe />
      </DatabaseProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('error')
    );
    expect(
      records.some((r) => r['event'] === 'db.open.failed')
    ).toBe(true);
  });

  it('ignores a DB that opens after unmount (no state update leak)', async () => {
    let resolveOpen: ((db: FakeDb) => void) | undefined;
    const open = vi.fn(
      () =>
        new Promise<FakeDb>((resolve) => {
          resolveOpen = resolve;
        })
    );
    const { unmount } = render(
      <DatabaseProvider open={open}>
        <Probe />
      </DatabaseProvider>
    );
    unmount();
    resolveOpen?.(new FakeDb());
    // Flush the microtask queue; the cancelled guard must swallow the result.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(open).toHaveBeenCalledOnce();
  });

  it('useDatabase throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('inside <DatabaseProvider>');
    vi.restoreAllMocks();
  });
});
