import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import { isWebDemoServe, webDemo } from './vite-plugins/web-demo';
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

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  // Browser web demo: dev server only, never a build (vite-plugins/web-demo.ts).
  const webDemoOn = isWebDemoServe(command, env.VITE_WEB_DEMO);
  const plugins: PluginOption[] = [react(), tailwindcss()];
  if (webDemoOn) {
    plugins.push(webDemo());
  }

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
      // Constant `false` in every build, so demo-only code (the browser database) is removed.
      __KAGAZ_DEMO__: JSON.stringify(webDemoOn),
    },
    // Dev only. These are first imported by a lazy PDF chunk, so Vite used to discover them
    // mid-session, re-optimize and RELOAD the page, dropping in-memory state. Declaring
    // them up front avoids that.
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
        // Ionic component files only *define* their element inside
        // defineCustomElement(), which @ionic/react calls the first time a
        // component renders — importing one does nothing. Neither Ionic
        // package declares `sideEffects`, so every component (datetime,
        // select, range, picker…) was bundled whether used or not. Marking
        // just the component entry files side-effect-free lets the unused
        // ones drop out (2026-11-19 bundle pass).
        treeshake: {
          moduleSideEffects: (id: string): boolean | undefined =>
            /[\\/]@ionic[\\/]core[\\/]components[\\/]ion-[a-z-]+\.js$/.test(id) ? false : undefined,
        },
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
          // Rolldown code-splitting groups (Vite 8; `manualChunks` is deprecated
          // and skipped virtual modules — see the preload-helper note below).
          codeSplitting: {
            groups: [
              {
                // React + Ionic + router ship in ONE vendor chunk (~168 KB gz
                // with only the Ionic components the app renders): splitting
                // Ionic into a second initial-route chunk added an extra
                // critical-path request for zero byte saving. Vite's preload helper backs every
                // dynamic import(); left to the lib groups it was pulled into
                // lib-pdfjs, so every chunk — the entry included — statically
                // imported pdf.js (~88 KB gz) on cold start (2026-11-19).
                name: 'vendor',
                test: /vite[\\/](preload-helper|modulepreload-polyfill)|[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|history|@ionic|@stencil|ionicons)[\\/]/,
                priority: 20,
              },
              // Heavy media/office libraries, each with its own dependencies, in
              // their own lazy chunks so the bundle-size gate can keep them off
              // the initial route (G1-4). Lower priority than vendor, so a shared
              // module the framework group claims (the preload helper) never
              // lands in one of them.
              ...(
                [
                  ['lib-pdfjs', /[\\/]node_modules[\\/]pdfjs-dist[\\/]/],
                  ['lib-pdflib', /[\\/]node_modules[\\/]pdf-lib[\\/]/],
                  ['lib-docx', /[\\/]node_modules[\\/]docx[\\/]/],
                  // First-run tour (ADR-026): loads only when a tour runs.
                  ['lib-driver', /[\\/]node_modules[\\/]driver\.js[\\/]/],
                  ['lib-mammoth', /[\\/]node_modules[\\/]mammoth[\\/]/],
                  ['lib-jszip', /[\\/]node_modules[\\/]jszip[\\/]/],
                  // Schemas for the action registry / AI tools; never on the startup route.
                  ['lib-zod', /[\\/]node_modules[\\/]zod[\\/]/],
                ] as const
              ).map(([name, test]) => ({
                name,
                test,
                // jszip first: mammoth depends on it, and Settings (backups)
                // needs jszip alone, not the whole Word importer.
                priority: name === 'lib-jszip' ? 11 : 10,
              })),
            ],
          },
        },
      },
    },
  };
});
