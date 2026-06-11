#!/usr/bin/env node
/**
 * agent:lint — enforces the agent interface contract
 * (docs/design-system/agent-interface.md, page-skill-template.md):
 *
 *   1. Every page (PageName.tsx under a pages/ directory) ships a sibling
 *      PageName.agent.ts AND PageName.skill.md.
 *   2. skill-in-sync: every action referenced in a page's
 *      availableActions appears in the matching .skill.md.
 *   3. Every *.agent.ts has id + route + intent.
 *
 * Exit 1 on any violation. (DOM-level data-agent-id completeness is the
 * eslint `agent/completeness` rule's job, not this script's.)
 */
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { extractActions, extractPage, read, walk } from './agent-lib.mjs';

const APP_SRC = join(process.cwd(), 'apps', 'kagaz', 'src');
const errors = [];

// Local action-name → action-id index from every *.actions.ts.
const actionIdsByLocalName = new Map();
for (const file of walk(APP_SRC, (f) => f.endsWith('.actions.ts'))) {
  for (const action of extractActions(read(file))) {
    actionIdsByLocalName.set(action.localName, action.id);
  }
}

// Rule 1 + 2: pages ship .agent.ts + .skill.md, and skills stay in sync.
const pageFiles = walk(
  APP_SRC,
  (f) =>
    /[\\/]pages[\\/].*\.tsx$/.test(f) &&
    !f.includes('.test.') &&
    !f.includes('__tests__')
);

for (const page of pageFiles) {
  const dir = dirname(page);
  const base = basename(page, '.tsx');
  const agentFile = join(dir, `${base}.agent.ts`);
  const skillFile = join(dir, `${base}.skill.md`);

  if (!existsSync(agentFile)) {
    errors.push(`${page}: missing ${base}.agent.ts (page-skill-template.md)`);
  }
  if (!existsSync(skillFile)) {
    errors.push(`${page}: missing ${base}.skill.md (page-skill-template.md)`);
  }
  if (!existsSync(agentFile) || !existsSync(skillFile)) {
    continue;
  }

  const manifest = extractPage(read(agentFile));
  if (!manifest.id || !manifest.route || !manifest.intent) {
    errors.push(`${agentFile}: manifest must declare id, route, and intent`);
  }

  const skill = read(skillFile);
  for (const ref of manifest.availableActions) {
    const local = ref.split('.').pop() ?? ref;
    const id = actionIdsByLocalName.get(local);
    const mentioned =
      (id && skill.includes(id)) || skill.includes(local) || skill.includes(ref);
    if (!mentioned) {
      errors.push(
        `${skillFile}: action "${id ?? ref}" is in availableActions but never mentioned in the skill (skill-in-sync)`
      );
    }
  }
}

// Rule 3: orphan .agent.ts files (manifest without a page) are suspicious.
for (const agentFile of walk(APP_SRC, (f) => f.endsWith('.agent.ts'))) {
  const page = agentFile.replace(/\.agent\.ts$/, '.tsx');
  if (!existsSync(page)) {
    errors.push(`${agentFile}: no matching page component (${basename(page)})`);
  }
}

if (errors.length > 0) {
  console.error(`[agent:lint] ${errors.length} violation(s):\n`);
  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }
  process.exit(1);
}

console.error(
  `[agent:lint] OK — ${pageFiles.length} page(s), ${actionIdsByLocalName.size} action(s) checked.`
);
