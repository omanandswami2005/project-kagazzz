// Global test setup — referenced by vitest.config.ts `setupFiles`.
// Registers @testing-library/jest-dom matchers on Vitest's `expect`.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Node's experimental localStorage is unavailable without --localstorage-file,
// leaving jsdom's `window.localStorage` undefined. ThemeProvider (F-18, theme
// persistence) and the i18n language detector both use it — provide an
// in-memory shim and clear it between tests so nothing leaks across cases.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length(): number {
      return store.size;
    },
    clear: (): void => store.clear(),
    getItem: (key: string): string | null => store.get(key) ?? null,
    key: (index: number): string | null => [...store.keys()][index] ?? null,
    removeItem: (key: string): void => {
      store.delete(key);
    },
    setItem: (key: string, value: string): void => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
  });
}

afterEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // No localStorage in this context — nothing to clear.
  }
});

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
