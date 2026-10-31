/**
 * Demo-only browser database (jeep-sqlite = sql.js in the WebView, persisted to
 * IndexedDB). The shipped app is an Android APK with SQLCipher; a browser has
 * no SQLCipher, so this store is **unencrypted** and exists only so the app can
 * be demoed from `vite dev`. It is compiled in only when a demo env var is set
 * (see {@link isWebDemo}), so a normal production build tree-shakes it out.
 *
 * [SEC] Never enable for a release build — documents' metadata and OCR text
 * would sit unencrypted in the browser profile (10-security-architecture.md §3.2).
 */

/** True in demo builds (a local/cloud AI demo env var is set). Compile-time constant. */
export function isWebDemo(): boolean {
  return __KAGAZ_DEMO__ && Boolean(import.meta.env.VITE_OLLAMA_URL || import.meta.env.VITE_CLOUD_AI);
}

/** Registers and mounts the `<jeep-sqlite>` element and waits until it is ready. */
export async function mountWebStore(): Promise<void> {
  // The `if` on a compile-time constant is what lets a release build drop jeep-sqlite entirely.
  if (__KAGAZ_DEMO__) {
    const { defineCustomElements } = await import('jeep-sqlite/loader');
    defineCustomElements(window);
    if (!document.querySelector('jeep-sqlite')) {
      const element = document.createElement('jeep-sqlite');
      // autosave stays OFF: it exports the database after each statement, and sql.js export()
      // ends any open transaction. SqliteDbAdapter persists when idle instead.
      element.setAttribute('autosave', 'false');
      element.setAttribute('wasmpath', '/assets');
      document.body.appendChild(element);
    }
    await customElements.whenDefined('jeep-sqlite');
    return;
  }
  throw new Error('The browser database is only available in demo builds');
}
