import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,

    setupFiles: ['./src/test/setup.ts'],

    // Coverage gates per CONTRIBUTING.md — PRs below these thresholds fail.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/',
        // Entry point: executes render() on import; covered by App smoke test.
        'src/main.tsx',
        '**/*.types.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        '**/*.agent.ts',
        // Worker orchestration + the worker entry modules: integration-tested
        // by the real contract (pdf-engine.contract.test) via @vitest/web-worker,
        // but coverage instrumentation through the worker polyfill is unreliable.
        'src/modules/pdf-engine/services/pdf-engine.service.ts',
        // pdfjs + canvas rendering (F-6) only runs on a device, not jsdom.
        'src/modules/pdf-engine/services/pdf-render-ops.ts',
        // Compress: primary lib path is unit-tested; the rasterise fallback
        // (pdfjs/canvas) is device-only.
        'src/modules/pdf-engine/services/pdf-compress-ops.ts',
        'src/modules/pdf-engine/workers/**',
        '**/__contract__/**',
        // PDF Tools: engine + FileStorage I/O and the multi-op modal are
        // integration/device-verified (real workers, real files, IonModal).
        'src/modules/pdf-engine/hooks/usePdfEngine.ts',
        'src/modules/pdf-engine/components/PdfOpSheet.tsx',
        // ── Device/integration surfaces (verified on-device per the checklist's
        // device-verification journals, not unit-testable in jsdom) — same
        // rationale as the exclusions above. Coverage below measures the
        // unit-testable core.
        // IonPage screens (navigation, native plugins, IonModal presentation):
        '**/pages/**',
        // Native-DB / theme / i18n providers + route dynamic-import thunks:
        '**/providers/**',
        'src/app/routes/lazy-imports.ts',
        // Declarative Action Registry wrappers (defineAction metadata):
        '**/*.actions.ts',
        // pdf-lib ops that execute inside the manipulation worker during the
        // real contract tests — coverage instrumentation through the worker
        // polyfill is unreliable (same as pdf-engine.service.ts / workers/**):
        'src/modules/pdf-engine/services/pdf-ops.ts',
        'src/modules/pdf-engine/services/pdf-forms-ops.ts',
        'src/modules/pdf-engine/services/pdf-security-ops.ts',
        // Native-plugin service wrappers (Keychain/Keystore biometrics, ML Kit
        // OCR, native SQLite) — exercised only on a device:
        'src/modules/auth/services/biometric.service.ts',
        'src/modules/image-engine/services/ocr.service.ts',
        'src/infrastructure/database/database.service.ts',
      ],
      // Aggregate thresholds (CONTRIBUTING.md §Testing "80% coverage"): the
      // whole unit-testable codebase must clear these in total. Per-file was
      // never achievable for device/UI/native code and is not the contract.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'coverage',
      '**/__tests__/fixtures/**',
    ],

    testTimeout: 10000,
    hookTimeout: 10000,

    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },

    isolate: true,
    pool: 'threads',
    maxWorkers: 4,

    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Vitest resolves Node export conditions; the app ships pino's
      // browser build (Vite), so tests must exercise the same code path
      // (browser.transmit etc. are no-ops in the Node build).
      pino: 'pino/browser.js',
    },
  },
});
