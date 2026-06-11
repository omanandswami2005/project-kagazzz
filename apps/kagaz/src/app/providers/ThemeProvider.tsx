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
  const [theme, setTheme] = useState<ThemeSetting>('system');
  const [density, setDensity] = useState<DensityMode>(DEFAULT_DENSITY);
  const [highContrast, setHighContrast] = useState(false);

  const apply = useCallback((): void => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, resolveTheme(theme));
    root.setAttribute(DENSITY_ATTRIBUTE, density);
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
    [theme, density, highContrast]
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
