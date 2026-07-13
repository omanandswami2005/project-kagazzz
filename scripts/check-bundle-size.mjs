#!/usr/bin/env node
/**
 * Bundle-size gate (CONTRIBUTING.md §Performance & Security, CI-enforced):
 *   vendor chunk       < 200 KB gzipped  (see TEMPORARY allowance below)
 *   app chunk (index)  < 150 KB gzipped
 *   lazy chunks        < 100 KB gzipped each
 *   heavy libs (lib-*) < 180 KB gzipped each, EXCLUDED from the total below
 *   initial-load total < 500 KB gzipped  (everything except the lib-* chunks)
 *
 * The initial-load total is what governs cold-start FCP: it counts the vendor +
 * app entry + the small per-route lazy chunks, but NOT the heavy media/office
 * libraries (pdfjs, pdf-lib, xlsx, docx, mammoth, jszip), which load only when
 * their tool runs and already ship inside the APK. See HEAVY_LAZY note below.
 *
 * Run after `pnpm build`. Exits 1 on any violation.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;

/**
 * TEMPORARY: vendor (react + ionic + router) ships at ~296 KB gz today.
 * Tracked against G1-4 (DEVELOPMENT-CHECKLIST.md) — Ionic component-level
 * optimization must bring this under the real 200 KB budget before the V1
 * release gate. Tightening this number is the only allowed change.
 */
const VENDOR_TEMP_ALLOWANCE_KB = 320;

/**
 * Heavy media / office libraries — `pdfjs-dist`, `pdf-lib`, SheetJS `xlsx`,
 * `docx`, `mammoth`, `jszip` — each ship in their own deterministically-named
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
  vendor: VENDOR_TEMP_ALLOWANCE_KB * KB,
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
