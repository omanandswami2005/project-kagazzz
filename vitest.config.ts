import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',
    globals: true,

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: true,
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.types.ts',
        '**/*.d.ts',
        '**/index.ts',
        'dist/',
        '.next/',
        'coverage/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
      // Exclude specific files
      perFile: true,
      skipFull: false,
    },

    // Include/exclude patterns
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

    // Test timeout (ms)
    testTimeout: 10000,

    // Mock reset between tests
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // Environment options
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },

    // Hook timeout
    hookTimeout: 10000,

    // Isolate test environment
    isolate: true,

    // Threads
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    // Reporters
    reporters: ['verbose'],

    // Silent console output during tests
    silent: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
