import { beforeAll, describe, expect, it } from 'vitest';
import { i18n, initI18n, DEFAULT_LANGUAGE, NAMESPACES, SUPPORTED_LANGUAGES } from '..';

beforeAll(async () => {
  window.localStorage.clear();
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('i18n configuration (12-i18n §3.3)', () => {
  it('declares the V1 languages and all namespaces', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'hi']);
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(NAMESPACES).toContain('common');
    expect(NAMESPACES).toContain('csc-services');
  });

  it('resolves English strings from the default namespace', () => {
    expect(i18n.t('buttons.save')).toBe('Save');
    expect(i18n.t('labels.all_documents')).toBe('All Documents');
  });

  it('switches to Hindi at runtime', async () => {
    await i18n.changeLanguage('hi');
    expect(i18n.t('buttons.save')).toBe('सहेजें');
    expect(i18n.t('title', { ns: 'documents' })).toBe('मेरे दस्तावेज़');
    await i18n.changeLanguage('en');
  });

  it('interpolates variables', () => {
    expect(i18n.t('errors.file_too_large', { maxSize: 50 })).toBe(
      'File is too large. Maximum size is 50 MB.'
    );
  });

  it('pluralizes count-based keys', () => {
    expect(i18n.t('time.minutes_ago', { count: 1 })).toBe('1 minute ago');
    expect(i18n.t('time.minutes_ago', { count: 5 })).toBe('5 minutes ago');
  });

  it('falls back to English for unsupported languages', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.resolvedLanguage).toBe('en');
    expect(i18n.t('buttons.save')).toBe('Save');
    await i18n.changeLanguage('en');
  });

  it('persists the chosen language in localStorage (detector cache)', async () => {
    await i18n.changeLanguage('hi');
    expect(window.localStorage.getItem('i18nextLng')).toBe('hi');
    await i18n.changeLanguage('en');
  });

  it('initI18n is idempotent', async () => {
    const again = await initI18n();
    expect(again.isInitialized).toBe(true);
  });
});
