import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DENSITY,
  DENSITY_MODES,
  isDensityMode,
  isTheme,
  THEMES,
} from '../index';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string): string => readFileSync(join(srcDir, file), 'utf8');

const allCss = [
  'tokens.css',
  'dark-mode.css',
  'density.css',
  'high-contrast.css',
  'agent-inspector.css',
]
  .map(read)
  .join('\n');

describe('token definitions (design-tokens.md v2.0)', () => {
  it('defines the brand palette verbatim', () => {
    expect(allCss).toContain('--color-primary: #1e3a5f');
    expect(allCss).toContain('--color-secondary: #f59e0b');
    expect(allCss).toContain('--color-accent: #10b981');
    expect(allCss).toContain('--color-danger: #f43f5e');
  });

  it('every var() reference resolves to a defined token', () => {
    const defined = new Set(
      [...allCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
    );
    const referenced = [...allCss.matchAll(/var\((--[\w-]+)\)/g)].map(
      (m) => m[1]
    );
    const missing = referenced.filter((token) => !defined.has(token));
    expect(missing).toEqual([]);
  });

  it('defines all three density modes with the documented metrics', () => {
    const density = read('density.css');
    expect(density).toContain("data-density='simple'");
    expect(density).toContain("data-density='comfortable'");
    expect(density).toContain("data-density='compact'");
    expect(density).toContain('--row-h: 80px');
    expect(density).toContain('--row-h: 56px');
    expect(density).toContain('--row-h: 44px');
    expect(density).toContain('--target-min: 64px');
    expect(density).toContain('--target-min: 48px');
    expect(density).toContain('--target-min: 40px');
    expect(density).toContain('font-size: calc(16px * var(--scale))');
  });

  it('simple mode suppresses shadows/motion and widens the focus ring', () => {
    const simpleBlock = read('density.css').split("data-density='simple'")[1];
    expect(simpleBlock).toContain('--shadow-default: none');
    expect(simpleBlock).toContain('--duration-default: 0ms');
    expect(simpleBlock).toContain('--focus-ring-width: 4px');
  });

  it('dark mode overrides surfaces, text, and focus border', () => {
    const dark = read('dark-mode.css');
    expect(dark).toContain("[data-theme='dark']");
    expect(dark).toContain('--surface-1: #0f172a');
    expect(dark).toContain('--text-primary: #f8fafc');
    expect(dark).toContain('--border-focus: #60a5fa');
  });

  it('respects prefers-reduced-motion', () => {
    expect(read('tokens.css')).toContain('prefers-reduced-motion: reduce');
  });

  it('index.css imports every token sheet', () => {
    const index = read('index.css');
    for (const sheet of [
      'tokens.css',
      'dark-mode.css',
      'density.css',
      'high-contrast.css',
      'agent-inspector.css',
    ]) {
      expect(index).toContain(sheet);
    }
  });
});

describe('typed companions', () => {
  it('exposes the documented modes', () => {
    expect(DENSITY_MODES).toEqual(['simple', 'comfortable', 'compact']);
    expect(DEFAULT_DENSITY).toBe('comfortable');
    expect(THEMES).toEqual(['light', 'dark']);
  });

  it('type guards accept valid values and reject garbage', () => {
    expect(isDensityMode('simple')).toBe(true);
    expect(isDensityMode('cozy')).toBe(false);
    expect(isDensityMode(42)).toBe(false);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('blue')).toBe(false);
  });
});
