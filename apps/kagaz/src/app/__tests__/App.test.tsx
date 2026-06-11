/**
 * Shell smoke test: the full provider chain + router renders the home
 * page even when the native SQLite layer is unavailable (jsdom) — the
 * DatabaseProvider degrades to its error state without taking the UI down.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDiagnosticSink } from '@/core/logging';
import { App } from '../App';

describe('App shell', () => {
  beforeEach(() => {
    // Native SQLite is absent in jsdom — silence the expected fatal noise.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    setDiagnosticSink(null);
    vi.restoreAllMocks();
  });

  it('boots providers, router, and the lazy home page', async () => {
    render(<App />);
    await waitFor(
      () =>
        expect(
          screen.getByText(/My Documents|मेरे दस्तावेज़/)
        ).toBeInTheDocument(),
      { timeout: 10000 }
    );
    // Theme attributes applied by ThemeProvider during boot.
    expect(document.documentElement.getAttribute('data-density')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBeTruthy();
    // The home page exposes its agent surface.
    expect(document.querySelector('[data-agent-id="app.home"]')).not.toBeNull();
  });
});
