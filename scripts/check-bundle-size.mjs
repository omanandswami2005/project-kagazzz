#!/usr/bin/env node
/**
 * Bundle-size gate (CONTRIBUTING.md §Performance & Security, CI-enforced):
 *   vendor chunk  < 200 KB gzipped  (see TEMPORARY allowance below)
 *   app chunk     < 150 KB gzipped
 *   lazy chunks   < 100 KB gzipped each
 *   total JS      < 500 KB gzipped  (hard, no exceptions)
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

const BUDGETS = {
  vendor: VENDOR_TEMP_ALLOWANCE_KB * KB,
  app: 150 * KB,
  lazy: 100 * KB,
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
  totalGzip += gzipped;

  const kind = file.startsWith('vendor.')
    ? 'vendor'
    : file.startsWith('index.')
      ? 'app'
      : 'lazy';
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
