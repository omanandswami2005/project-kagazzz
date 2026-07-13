/**
 * Generates the in-app "Open-source licenses" data (G1-5) from the app's actual
 * runtime dependencies. Reads each dependency's package.json `license` field and
 * writes src/modules/settings/content/third-party-licenses.json.
 *
 * Re-run after changing dependencies:  pnpm --filter kagaz gen:licenses
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appDir, '..', '..');
const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));

/** Reads a dependency's package.json, checking the app then the hoisted root. */
function readDepPkg(name) {
  for (const base of [appDir, repoRoot]) {
    const p = join(base, 'node_modules', name, 'package.json');
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8'));
    }
  }
  return null;
}

function licenseOf(j) {
  if (!j) return 'UNKNOWN';
  if (typeof j.license === 'string') return j.license;
  if (j.license?.type) return j.license.type;
  if (Array.isArray(j.licenses) && j.licenses[0]?.type) return j.licenses[0].type;
  return 'UNKNOWN';
}

const rows = Object.keys(pkg.dependencies)
  .filter((d) => !d.startsWith('@kagaz/')) // first-party workspace packages
  .map((name) => {
    const j = readDepPkg(name);
    return { name, version: j?.version ?? '', license: licenseOf(j) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const outPath = join(appDir, 'src/modules/settings/content/third-party-licenses.json');
writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`[gen:licenses] wrote ${rows.length} entries to ${outPath}`);
const unknown = rows.filter((r) => r.license === 'UNKNOWN');
if (unknown.length) {
  console.warn(`[gen:licenses] ${unknown.length} UNKNOWN: ${unknown.map((r) => r.name).join(', ')}`);
}
