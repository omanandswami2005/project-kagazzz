/// <reference types="vite/client" />

// CSS exports from workspace packages (side-effect imports, no types).
declare module '@kagaz/design-tokens/css';
declare module '@kagaz/ui/styles.css';

/** package.json's `version`, injected at build time (vite.config.ts `define`). */
declare const __APP_VERSION__: string;

/**
 * Compile-time flag: true only in demo builds (VITE_OLLAMA_URL or VITE_CLOUD_AI set) and in
 * tests. In a normal/production build it is the constant `false`, so the bundler removes all
 * demo-only code (browser database, cloud and Ollama engines, vision fallbacks).
 */
declare const __KAGAZ_DEMO__: boolean;
