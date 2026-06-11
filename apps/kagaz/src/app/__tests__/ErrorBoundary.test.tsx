import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDiagnosticSink, type LogRecord } from '@/core/logging';
import { ErrorBoundary } from '../ErrorBoundary';

function Bomb(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary ([SEC] local-only crash capture)', () => {
  const records: LogRecord[] = [];

  beforeEach(() => {
    records.length = 0;
    setDiagnosticSink({ write: (r) => records.push(r) });
    // React logs caught render errors to console.error — keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    setDiagnosticSink(null);
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('catches render crashes, logs fatal locally, shows recovery UI', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Restart' })
    ).toHaveAttribute('data-agent-id', 'app.crash.reload-btn');

    const fatal = records.find((r) => r['event'] === 'app.crash.boundary');
    expect(fatal).toBeDefined();
    expect((fatal?.['err'] as LogRecord)['message']).toBe('kaboom');
  });
});
