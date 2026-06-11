import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
