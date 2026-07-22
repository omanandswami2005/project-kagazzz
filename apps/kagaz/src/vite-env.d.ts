/// <reference types="vite/client" />

// CSS exports from workspace packages (side-effect imports, no types).
declare module '@kagaz/design-tokens/css';
declare module '@kagaz/ui/styles.css';

/** package.json's `version`, injected at build time (vite.config.ts `define`). */
declare const __APP_VERSION__: string;
