import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,

    // No app code yet (P0-2 scaffolds src/) — remove once first tests land.
    passWithNoTests: true,

    setupFiles: ['./src/test/setup.ts'],

    // Coverage gates per CONTRIBUTING.md — PRs below these thresholds fail.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/test/',
        '**/*.types.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        '**/*.agent.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
        perFile: true,
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
