#!/usr/bin/env node
/**
 * agent:sitemap — regenerates agent-sitemap.json from every *.agent.ts
 * page manifest and *.actions.ts registry
 * (docs/design-system/agent-interface.md §The AgentSitemap).
 *
 * Output: apps/kagaz/public/agent-sitemap.json (shipped with the app; the
 * AI assistant uses it for navigation and voice disambiguation).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractActions, extractPage, read, walk } from './agent-lib.mjs';

const APP_SRC = join(process.cwd(), 'apps', 'kagaz', 'src');
const OUT_DIR = join(process.cwd(), 'apps', 'kagaz', 'public');
const OUT_FILE = join(OUT_DIR, 'agent-sitemap.json');

const actions = {};
for (const file of walk(APP_SRC, (f) => f.endsWith('.actions.ts'))) {
  for (const action of extractActions(read(file))) {
    actions[action.id] = {
      summary: action.summary,
      voice: action.voice,
      requiresConfirmation: action.requiresConfirmation,
    };
  }
}

const pages = {};
const voiceIndex = [];
for (const file of walk(APP_SRC, (f) => f.endsWith('.agent.ts'))) {
  const manifest = extractPage(read(file));
  if (!manifest.id) {
    continue;
  }
  pages[manifest.id] = {
    route: manifest.route,
    intent: manifest.intent,
    primary: manifest.primary ?? null,
    actions: manifest.availableActions,
  };
  for (const example of manifest.voiceExamples) {
    voiceIndex.push({
      utterance: example.utterance,
      pages: [manifest.id],
      action: example.action,
    });
  }
}

// No timestamp: the file is committed and CI re-generates it to detect
// drift (git diff --exit-code) — the output must be deterministic.
const sitemap = {
  $schema: 'docs/design-system/agent-interface.md#the-agentsitemap',
  pages,
  actions,
  voiceIndex,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(sitemap, null, 2)}\n`, 'utf8');
console.error(
  `[agent:sitemap] Wrote ${OUT_FILE} — ${Object.keys(pages).length} page(s), ` +
    `${Object.keys(actions).length} action(s), ${voiceIndex.length} voice utterance(s).`
);
