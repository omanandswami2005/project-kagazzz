import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import { demoCsp } from './vite-plugins/demo-csp';
import { cloudAiProxy } from './vite-plugins/cloud-ai-proxy';
import { webSqliteWasm } from './vite-plugins/web-sqlite-wasm';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

// Build configuration per docs/architecture/01-system-architecture.md
// §Build & Platform Configuration: route-based code splitting (React.lazy),
// Vite `?worker` imports for heavy ops, bundle analysis via `--mode analyze`.
//
// App version (2026-07-21 fix): previously read from a `VITE_APP_VERSION`
// env var that nothing ever actually set — no .env file ships (only
// .env.example, gitignored), no CI/build step injected it — so Settings'
// "About" screen always showed the '0.0.0-dev' fallback, never the real
// released version, regardless of what package.json said. Reading
// package.json directly at build time makes it a single source of truth
// with no env var to forget to set.
const appVersion = (
  JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as {
    version: string;
  }
).version;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
    demoCsp({ ollamaUrl: env.VITE_OLLAMA_URL, cloudAi: env.VITE_CLOUD_AI }, mode),
  ];
  if (env.VITE_OLLAMA_URL || env.VITE_CLOUD_AI) {
    plugins.push(webSqliteWasm());
  }
  plugins.push(cloudAiProxy(Boolean(env.VITE_CLOUD_AI)));

  if (mode === 'analyze') {
    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: true,
      })
    );
  }

  return {
    plugins,
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __KAGAZ_DEMO__: JSON.stringify(Boolean(env.VITE_OLLAMA_URL || env.VITE_CLOUD_AI)),
    },
    // Dev only. These are first imported by a lazy PDF chunk, so Vite used to discover them
    // mid-session, re-optimize and RELOAD the page — dropping in-memory state such as the
    // AI connection (found while rehearsing the demo). Declaring them up front avoids that.
    optimizeDeps: { include: ['@pdfsmaller/pdf-encrypt', '@pdfsmaller/pdf-decrypt'] },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Heavy ops (PDF, image, OCR, LLM inference) run in Web Workers,
    // imported with the `?worker` suffix and emitted under assets/workers/.
    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/workers/[name].[hash].js',
          chunkFileNames: 'assets/workers/[name].[hash].js',
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: mode !== 'production',
      // Lazy module chunks must stay < 100KB gzipped (CONTRIBUTING.md
      // performance budgets); 300KB pre-minify flags drift early.
      chunkSizeWarningLimit: 300,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/js/[name].[hash].js',
          chunkFileNames: 'assets/js/[name].[hash].js',
          assetFileNames: 'assets/[ext]/[name].[hash][extname]',
          // Framework code ships in one stable vendor chunk; feature modules
          // (vault, scanner, ai, pdf-engine, csc) split automatically via
          // React.lazy() route-level dynamic imports. The heavy media/office
          // libraries get their own deterministically-named lazy chunks so the
          // bundle-size gate can account for them explicitly (G1-4): they are
          // off the initial route and ship inside the APK, so they never hit
          // cold-start FCP.
          manualChunks: (id: string): string | undefined => {
            // React + Ionic + router ship in ONE vendor chunk: splitting Ionic
            // into a second initial-route chunk added an extra critical-path
            // request that shaved ~0.02 off the Lighthouse score (0.86→0.84,
            // below the temp floor) for zero byte saving. The framework is
            // Ionic-dominated (~54 KB React vs ~237 KB Ionic) — real reduction
            // needs a heavy-overlay-component refactor, not a chunk relabel.
            if (
              /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|history|@ionic|@stencil|ionicons)[\\/]/.test(
                id
              )
            ) {
              return 'vendor';
            }
            if (/[\\/]node_modules[\\/]pdfjs-dist[\\/]/.test(id)) return 'lib-pdfjs';
            if (/[\\/]node_modules[\\/]pdf-lib[\\/]/.test(id)) return 'lib-pdflib';
            if (/[\\/]node_modules[\\/]xlsx[\\/]/.test(id)) return 'lib-xlsx';
            if (/[\\/]node_modules[\\/]docx[\\/]/.test(id)) return 'lib-docx';
            if (/[\\/]node_modules[\\/]mammoth[\\/]/.test(id)) return 'lib-mammoth';
            if (/[\\/]node_modules[\\/]jszip[\\/]/.test(id)) return 'lib-jszip';
            return undefined;
          },
        },
      },
    },
  };
});
