/// <reference types="vite/client" />

// CSS exports from workspace packages (side-effect imports, no types).
declare module '@kagaz/design-tokens/css';
declare module '@kagaz/ui/styles.css';

/** package.json's `version`, injected at build time (vite.config.ts `define`). */
declare const __APP_VERSION__: string;

/**
 * Compile-time flag: true only on the web-demo dev server (`VITE_WEB_DEMO=1 vite`) and in
 * tests. In every `vite build` it is the constant `false`, so the bundler removes all
 * demo-only code (the unencrypted browser database). See vite-plugins/web-demo.ts.
 */
declare const __KAGAZ_DEMO__: boolean;
