import path from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

// Build configuration per docs/architecture/01-system-architecture.md
// §Build & Platform Configuration: route-based code splitting (React.lazy),
// Vite `?worker` imports for heavy ops, bundle analysis via `--mode analyze`.
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()];

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
