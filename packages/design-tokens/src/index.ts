/**
 * Typed companions to the token CSS — density/theme/contrast mode names
 * and the HTML attributes that activate them
 * (docs/design-system/design-tokens.md).
 */

/** Density modes (design-principles.md #6: a user setting, not a default). */
export const DENSITY_MODES = ['simple', 'comfortable', 'compact'] as const;

/** One of the three density modes. */
export type DensityMode = (typeof DENSITY_MODES)[number];

/** Default density for mobile. */
export const DEFAULT_DENSITY: DensityMode = 'comfortable';

/** Color themes. */
export const THEMES = ['light', 'dark'] as const;

/** One of the color themes. */
export type Theme = (typeof THEMES)[number];

/** HTML attribute carrying the density mode (set on <html>). */
export const DENSITY_ATTRIBUTE = 'data-density';

/** HTML attribute carrying the theme (set on <html>). */
export const THEME_ATTRIBUTE = 'data-theme';

/** HTML attribute enabling high-contrast overrides (set on <html>). */
export const CONTRAST_ATTRIBUTE = 'data-contrast';

/** Type guard for {@link DensityMode}. */
export function isDensityMode(value: unknown): value is DensityMode {
  return (
    typeof value === 'string' && (DENSITY_MODES as readonly string[]).includes(value)
  );
}

/** Type guard for {@link Theme}. */
export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}
