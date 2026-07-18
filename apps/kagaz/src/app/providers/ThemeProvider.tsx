/**
 * Theme + density provider (P0-10). Applies the design-token activation
 * attributes on <html> (@kagaz/design-tokens). Full settings UI is F-18;
 * this provider is its mount point.
 */
import {
  CONTRAST_ATTRIBUTE,
  DEFAULT_DENSITY,
  DENSITY_ATTRIBUTE,
  THEME_ATTRIBUTE,
  type DensityMode,
  type Theme,
} from '@kagaz/design-tokens';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** User theme preference ('system' follows the OS). */
export type ThemeSetting = Theme | 'system';

/** What ThemeContext exposes. */
export interface ThemeContextValue {
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
  highContrast: boolean;
  setHighContrast: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme lives in localStorage, not the SQLCipher `app_settings` DAO: this
 * provider mounts *outside* DatabaseProvider (AppProviders order), so the DB
 * isn't open yet, and localStorage is synchronous — it applies the saved
 * theme on first render with no flash. Theme is a non-sensitive UI preference.
 */
const THEME_STORAGE_KEY = 'kagaz:theme';
const THEME_SETTINGS: readonly ThemeSetting[] = ['system', 'light', 'dark'];

function readStoredTheme(): ThemeSetting {
  if (typeof localStorage === 'undefined') {
    return 'system';
  }
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_SETTINGS.includes(stored as ThemeSetting)
    ? (stored as ThemeSetting)
    : 'system';
}

function storeTheme(theme: ThemeSetting): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / quota — persistence is best-effort, not fatal.
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function resolveTheme(setting: ThemeSetting): Theme {
  return setting === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : setting;
}

/** Applies data-theme / data-density / data-contrast on <html>. */
export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const [theme, setThemeState] = useState<ThemeSetting>(readStoredTheme);
  const [density, setDensity] = useState<DensityMode>(DEFAULT_DENSITY);
  const [highContrast, setHighContrast] = useState(false);

  // F-18: persist the manual theme choice so it survives an app restart.
  const setTheme = useCallback((next: ThemeSetting): void => {
    setThemeState(next);
    storeTheme(next);
  }, []);

  const apply = useCallback((): void => {
    const root = document.documentElement;
    const resolved = resolveTheme(theme);
    root.setAttribute(THEME_ATTRIBUTE, resolved);
    root.setAttribute(DENSITY_ATTRIBUTE, density);
    // Drive Ionic's class-based dark palette in lock-step with our tokens.
    root.classList.toggle('ion-palette-dark', resolved === 'dark');
    if (highContrast) {
      root.setAttribute(CONTRAST_ATTRIBUTE, 'high');
    } else {
      root.removeAttribute(CONTRAST_ATTRIBUTE);
    }
  }, [theme, density, highContrast]);

  useEffect(() => {
    apply();
    if (
      theme === 'system' &&
      typeof window.matchMedia === 'function'
    ) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', apply);
      return (): void => media.removeEventListener('change', apply);
    }
    return undefined;
  }, [apply, theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      density,
      setDensity,
      highContrast,
      setHighContrast,
    }),
    [theme, setTheme, density, highContrast]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the theme controls; throws outside the provider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
