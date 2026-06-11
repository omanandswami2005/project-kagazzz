// Global test setup — referenced by vitest.config.ts `setupFiles`.
// Registers @testing-library/jest-dom matchers on Vitest's `expect`.
import '@testing-library/jest-dom/vitest';

// jsdom has no matchMedia; ThemeProvider and Ionic both consult it.
// Plain functions (not vi.fn): vitest's mockReset would wipe vi.fn
// implementations between tests.
if (typeof window !== 'undefined' && !window.matchMedia) {
  const noop = (): void => undefined;
  window.matchMedia = ((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: (): boolean => false,
  }));
}
