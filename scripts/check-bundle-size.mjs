#!/usr/bin/env node
/**
 * Bundle-size gate (CONTRIBUTING.md §Performance & Security, CI-enforced):
 *   vendor chunk       < 200 KB gzipped  (React + Ionic + router)
 *   app chunk (index)  < 150 KB gzipped
 *   lazy chunks        < 100 KB gzipped each
 *   heavy libs (lib-*) < 180 KB gzipped each, EXCLUDED from the total below
 *   initial-load total < 500 KB gzipped  (everything except the lib-* chunks)
 *
 * The initial-load total is what governs cold-start FCP: it counts the vendor +
 * app entry + the small per-route lazy chunks, but NOT the heavy media/office
 * libraries (pdfjs, pdf-lib, docx, mammoth, jszip, driver.js, zod), which load
 * only when their tool runs and already ship inside the APK. See HEAVY_LAZY note
 * below. The gate also checks that no lib-* chunk is reachable from the entry
 * through static imports.
 *
 * Run after `pnpm build`. Exits 1 on any violation.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;

/**
 * Vendor (React + Ionic + router, one chunk) is back on the real 200 KB budget
 * (2026-11-19): it was ~291 KB only because every Ionic component was bundled
 * whether used or not. vite.config marks Ionic's component entry files
 * side-effect-free, so only the ~27 components the app renders ship (~168 KB).
 */
const VENDOR_BUDGET_KB = 200;

/**
 * Heavy lazy libraries — `pdfjs-dist`, `pdf-lib`, `docx`, `mammoth`, `jszip`,
 * `driver.js` (first-run tour), `zod` (action/AI tool schemas) — each ship in their own deterministically-named
 * `lib-*` lazy chunk (see vite.config manualChunks). They load only the first
 * time the matching tool runs (render/compress/convert/view), never on the
 * initial route, and on the Capacitor build they already sit inside the APK —
 * so they never affect cold-start FCP or the initial download. They are
 * therefore measured against a dedicated per-chunk budget and EXCLUDED from the
 * initial-load TOTAL. Tracked against G1-4: keep every `lib-*` chunk strictly
 * off the initial route (reached only via dynamic import).
 */
const HEAVY_LAZY_BUDGET_KB = 180;

const BUDGETS = {
  vendor: VENDOR_BUDGET_KB * KB,
  app: 150 * KB,
  lazy: 100 * KB,
  heavyLazy: HEAVY_LAZY_BUDGET_KB * KB,
  total: 500 * KB,
};

const jsDir = join(process.cwd(), 'apps', 'kagaz', 'dist', 'assets', 'js');

let files;
try {
  files = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`[bundle-size] ${jsDir} not found — run \`pnpm build\` first.`);
  process.exit(1);
}

const errors = [];
let totalGzip = 0;
const rows = [];

for (const file of files) {
  const gzipped = gzipSync(readFileSync(join(jsDir, file))).length;

  const kind = file.startsWith('lib-')
    ? 'heavyLazy'
    : file.startsWith('vendor.')
      ? 'vendor'
      : file.startsWith('index.')
        ? 'app'
        : 'lazy';
  // Heavy media/office libs (lib-*) are off the initial route and in-APK —
  // excluded from the initial-load total (they have their own budget).
  if (kind !== 'heavyLazy') {
    totalGzip += gzipped;
  }
  const budget = BUDGETS[kind];
  const ok = gzipped <= budget;
  rows.push(
    `${ok ? '  ' : '✗ '}${file.padEnd(40)} ${(gzipped / KB).toFixed(1).padStart(7)} KB gz (${kind} ≤ ${budget / KB} KB)`
  );
  if (!ok) {
    errors.push(
      `${file}: ${(gzipped / KB).toFixed(1)} KB gz exceeds the ${kind} budget of ${budget / KB} KB`
    );
  }
}

/**
 * Startup-route guard (2026-11-19): a `lib-*` chunk is excluded from the total
 * only because it is never on the initial route. Verify that — walk the static
 * import graph from the entry chunk and fail if it reaches any `lib-*` chunk.
 * (A shared helper once landed inside lib-pdfjs and put pdf.js on every cold
 * start without this gate noticing.)
 */
const staticImportsOf = (file) => {
  const code = readFileSync(join(jsDir, file), 'utf8');
  return [...code.matchAll(/(?:\bfrom\s*|\bimport\s*)["']\.\/([^"']+\.js)["']/g)].map((m) => m[1]);
};
const startup = new Set();
const queue = files.filter((f) => f.startsWith('index.'));
while (queue.length > 0) {
  const file = queue.pop();
  if (startup.has(file) || !files.includes(file)) continue;
  startup.add(file);
  queue.push(...staticImportsOf(file));
}
const startupGzip = [...startup].reduce((sum, f) => sum + gzipSync(readFileSync(join(jsDir, f))).length, 0);
for (const file of startup) {
  if (file.startsWith('lib-')) {
    errors.push(`${file} is statically imported on the startup route — lib-* chunks must stay lazy`);
  }
}
rows.push(`  ${'(startup route, static graph)'.padEnd(40)} ${(startupGzip / KB).toFixed(1).padStart(7)} KB gz`);

rows.push(
  `${totalGzip <= BUDGETS.total ? '  ' : '✗ '}${'TOTAL'.padEnd(40)} ${(totalGzip / KB).toFixed(1).padStart(7)} KB gz (total ≤ ${BUDGETS.total / KB} KB)`
);
if (totalGzip > BUDGETS.total) {
  errors.push(
    `Total gzipped JS ${(totalGzip / KB).toFixed(1)} KB exceeds the hard 500 KB budget`
  );
}

console.error(`[bundle-size] apps/kagaz/dist gzipped JS:\n${rows.join('\n')}`);

if (errors.length > 0) {
  console.error(`\n[bundle-size] FAILED:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.error('\n[bundle-size] OK');
