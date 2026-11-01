/**
 * Regression test for the F-65 "Share… silently fails" bug (fixed
 * 2026-07-21): `shareDocument`'s own unit test mocks `@capacitor/share`
 * entirely (see document-intent.service.test.ts), so it can never catch a
 * misconfigured native FileProvider — the bug that actually shipped. Every
 * vault document lives under `Directory.Data` (capacitor-fs.ts), so the
 * app's `file_paths.xml` must declare a root that covers it, or
 * `FileProvider.getUriForFile()` throws "Failed to find configured root" for
 * every real device share attempt (WhatsApp included) while unit tests stay
 * green throughout.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest runs with cwd == apps/kagaz (this project's package root).
const FILE_PATHS_XML = resolve(
  process.cwd(),
  'android/app/src/main/res/xml/file_paths.xml'
);

describe('Android FileProvider paths (F-65 regression)', () => {
  it('declares a root covering Directory.Data, where every document lives', () => {
    const xml = readFileSync(FILE_PATHS_XML, 'utf-8');
    // Directory.Data == getFilesDir() == a <files-path> root in FileProvider terms.
    expect(xml).toMatch(/<files-path\b/);
  });
});
