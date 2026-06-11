/**
 * QA gate (12-i18n §12): every language ships the exact same key
 * structure. A key added to en without its hi twin fails CI here.
 */
import { describe, expect, it } from 'vitest';

const modules = import.meta.glob('../locales/*/*.json', {
  eager: true,
  import: 'default',
});

interface LocaleFile {
  language: string;
  file: string;
  content: unknown;
}

const files: LocaleFile[] = Object.entries(modules).map(([path, content]) => {
  const match = /locales\/([^/]+)\/([^/]+\.json)$/.exec(path);
  return {
    language: match?.[1] ?? '',
    file: match?.[2] ?? '',
    content,
  };
});

const byLanguage = (lang: string): LocaleFile[] =>
  files.filter((f) => f.language === lang);

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe('locale parity (en ↔ hi)', () => {
  const enFiles = byLanguage('en');
  const hiFiles = byLanguage('hi');

  it('both languages ship the same namespace files', () => {
    expect(hiFiles.map((f) => f.file).sort()).toEqual(
      enFiles.map((f) => f.file).sort()
    );
    expect(enFiles.length).toBeGreaterThan(0);
  });

  it.each(enFiles.map((f) => f.file))(
    '%s has identical key structure in en and hi',
    (file) => {
      const en = enFiles.find((f) => f.file === file);
      const hi = hiFiles.find((f) => f.file === file);
      expect(keyPaths(hi?.content).sort()).toEqual(
        keyPaths(en?.content).sort()
      );
    }
  );

  it('hindi values are actually translated (not copied english)', () => {
    const en = enFiles.find((f) => f.file === 'common.json')?.content as {
      buttons: Record<string, string>;
    };
    const hi = hiFiles.find((f) => f.file === 'common.json')?.content as {
      buttons: Record<string, string>;
    };
    const identical = Object.keys(en.buttons).filter(
      (k) => en.buttons[k] === hi.buttons[k]
    );
    expect(identical).toEqual([]);
  });
});
