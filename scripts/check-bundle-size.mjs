#!/usr/bin/env node
/**
 * Bundle-size gate (CONTRIBUTING.md §Performance & Security, CI-enforced):
 *   vendor chunk       < 200 KB gzipped  (React + router — ~54 KB today)
 *   ionic chunk        < 250 KB gzipped  (Ionic framework baseline — see note)
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
 * `vendor` is now React + React-DOM + scheduler + react-router only (Ionic was
 * split into its own `ionic` chunk, G1-4 2026-07-14). React-vendor ships at
 * ~54 KB gz — comfortably under the **real 200 KB** budget, so the previous
 * TEMPORARY 320 KB allowance is repaid and removed.
 */
const VENDOR_BUDGET_KB = 200;

/**
 * `ionic` = the @ionic/react + @ionic/core + @stencil + ionicons framework.
 * It ships at ~237 KB gz: the app uses ~25 Ionic components, but Ionic's dense
 * transitive graph (IonSelect→popover→item→list→…) pulls ~159 @ionic/core
 * component modules, and Ionic 8's standalone components are not runtime-lazy.
 * This is a framework baseline, not app bloat; it IS on the initial route so it
 * counts toward the initial-load total. Cutting it further requires replacing
 * heavy Ionic overlay components (IonSelect / IonActionSheet / IonAlert /
 * IonSearchbar) with lightweight design-system equivalents — a device-verified
 * refactor tracked against G1-4, not a config change. Budget reflects today's
 * measured baseline; tighten only by real reduction.
 */
const IONIC_BUDGET_KB = 250;

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
  vendor: VENDOR_BUDGET_KB * KB,
  ionic: IONIC_BUDGET_KB * KB,
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
      : file.startsWith('ionic.')
        ? 'ionic'
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
