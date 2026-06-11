import { renderHook, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { i18n, initI18n } from '..';
import { useLocale } from '../hooks/useLocale';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('useLocale', () => {
  it('exposes the active locale, direction, and bound formatters', () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBe('en');
    expect(result.current.dir).toBe('ltr');
    expect(result.current.formatNumber(125000)).toBe('1,25,000');
    expect(result.current.formatFileSize(2048)).toBe('2 KB');
    expect(result.current.formatCurrency(99)).toContain('₹');
    expect(result.current.formatDate('2026-06-07')).toContain('June');
    expect(result.current.formatDateTime('2026-06-07T10:30:00')).toMatch(
      /10[:.]30/
    );
    expect(typeof result.current.formatRelativeTime(new Date())).toBe(
      'string'
    );
  });

  it('tracks language changes', async () => {
    const { result } = renderHook(() => useLocale());
    await i18n.changeLanguage('hi');
    await waitFor(() => expect(result.current.locale).toBe('hi'));
    expect(result.current.formatDate('2026-06-07')).toContain('जून');
    await i18n.changeLanguage('en');
  });

  it('falls back to i18n.language when resolvedLanguage is unset', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(i18n),
      'resolvedLanguage'
    );
    Object.defineProperty(i18n, 'resolvedLanguage', {
      configurable: true,
      get: () => undefined,
    });
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBe(i18n.language);
    if (descriptor) {
      Object.defineProperty(Object.getPrototypeOf(i18n), 'resolvedLanguage', descriptor);
    }
    delete (i18n as unknown as Record<string, unknown>)['resolvedLanguage'];
  });
});
