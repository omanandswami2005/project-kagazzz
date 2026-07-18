import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../ThemeProvider';

function Probe(): React.ReactNode {
  const { theme, setTheme, density, setDensity, setHighContrast } = useTheme();
  return (
    <div>
      <span data-testid="mode">{`${theme}/${density}`}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setDensity('simple')}>simple</button>
      <button onClick={() => setHighContrast(true)}>contrast</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('applies default attributes on <html>', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-density')).toBe(
      'comfortable'
    );
    expect(document.documentElement.hasAttribute('data-contrast')).toBe(false);
  });

  it('updates attributes when settings change', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));
    await userEvent.click(screen.getByRole('button', { name: 'simple' }));
    await act(async () => {
      screen.getByRole('button', { name: 'contrast' }).click();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-density')).toBe(
      'simple'
    );
    expect(document.documentElement.getAttribute('data-contrast')).toBe(
      'high'
    );
  });

  it('useTheme throws outside the provider', () => {
    expect(() => render(<Probe />)).toThrow('inside <ThemeProvider>');
  });

  describe('theme persistence (F-18)', () => {
    let store: Record<string, string>;
    beforeEach(() => {
      store = {};
      vi.stubGlobal('localStorage', {
        getItem: (k: string): string | null => store[k] ?? null,
        setItem: (k: string, v: string): void => {
          store[k] = v;
        },
        removeItem: (k: string): void => {
          delete store[k];
        },
        clear: (): void => {
          store = {};
        },
        key: (): null => null,
        length: 0,
      });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('restores the saved theme on mount', () => {
      store['kagaz:theme'] = 'dark';
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
      expect(screen.getByTestId('mode').textContent).toMatch(/^dark\//);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('persists a theme change to localStorage', async () => {
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
      await userEvent.click(screen.getByRole('button', { name: 'dark' }));
      expect(store['kagaz:theme']).toBe('dark');
    });

    it('ignores a corrupt stored value and falls back to system', () => {
      store['kagaz:theme'] = 'chartreuse';
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
      expect(screen.getByTestId('mode').textContent).toMatch(/^system\//);
    });
  });

  it('follows the system dark preference and tracks changes', () => {
    const original = window.matchMedia;
    const listeners: Array<() => void> = [];
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: (_t: string, fn: () => void): void => {
        listeners.push(fn);
      },
      removeEventListener: (): void => undefined,
      addListener: (): void => undefined,
      removeListener: (): void => undefined,
      dispatchEvent: (): boolean => false,
    })) as unknown as typeof window.matchMedia;

    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(listeners.length).toBeGreaterThan(0);
    unmount();
    window.matchMedia = original;
  });
});
