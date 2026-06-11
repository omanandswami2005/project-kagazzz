/**
 * Shared helpers for agent:lint / agent:sitemap.
 * Spec: docs/design-system/agent-interface.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  'android',
  'ios',
  '.git',
]);

/** Recursively collects file paths under `root` matching `predicate`. */
export function walk(root, predicate, out = []) {
  let entries;
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(root, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (!IGNORED_DIRS.has(entry)) {
        walk(full, predicate, out);
      }
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

/** Reads a file as UTF-8. */
export function read(file) {
  return readFileSync(file, 'utf8');
}

/**
 * Extracts `defineAction({ id: '...', summary: '...', ... })` metadata
 * from a *.actions.ts source. Text-level on purpose: scripts must not
 * depend on a TS compile of the app.
 */
export function extractActions(source) {
  const actions = [];
  const re =
    /(\w+)\s*:\s*defineAction\s*\(\s*\{[\s\S]*?id:\s*'([^']+)'[\s\S]*?summary:\s*'([^']*)'/g;
  for (const match of source.matchAll(re)) {
    const [, localName, id, summary] = match;
    const block = match[0];
    const voiceMatch = block.match(/voice:\s*\[([^\]]*)\]/);
    const voice = voiceMatch
      ? [...voiceMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
      : [];
    const confirmation = /requiresConfirmation:\s*true/.test(block);
    actions.push({ localName, id, summary, voice, requiresConfirmation: confirmation });
  }
  return actions;
}

/** Extracts the page manifest fields from a *.agent.ts source. */
export function extractPage(source) {
  const id = source.match(/id:\s*'([^']+)'/)?.[1];
  const route = source.match(/route:\s*'([^']+)'/)?.[1];
  const intent = source.match(/intent:\s*'([^']*)'/)?.[1];
  const primary = source.match(/primaryAction:\s*(\w+(?:Actions)?\.\w+)/)?.[1];
  const availableBlock = source.match(/availableActions:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
  const availableActions = [
    ...availableBlock.matchAll(/(\w+(?:Actions)?\.\w+)/g),
  ].map((m) => m[1]);
  const voiceExamples = [
    ...source.matchAll(/utterance:\s*'([^']+)'\s*,\s*action:\s*'([^']+)'/g),
  ].map((m) => ({ utterance: m[1], action: m[2] }));
  return { id, route, intent, primary, availableActions, voiceExamples };
}
