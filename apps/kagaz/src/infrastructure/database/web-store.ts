/**
 * Demo-only browser database (jeep-sqlite = sql.js in the WebView, persisted to
 * IndexedDB). The shipped app is an Android APK with SQLCipher; a browser has
 * no SQLCipher, so this store is **unencrypted** and exists only so the app can
 * be tested from the web-demo dev server (`pnpm --filter kagaz dev:web-demo`).
 * `__KAGAZ_DEMO__` is `false` in every build, so a release tree-shakes it out.
 *
 * [SEC] Never enable for a release build — documents' metadata and OCR text
 * would sit unencrypted in the browser profile (10-security-architecture.md §3.2).
 */

/** True only on the web-demo dev server. Compile-time constant (`false` in every build). */
export function isWebDemo(): boolean {
  return __KAGAZ_DEMO__ && import.meta.env.VITE_WEB_DEMO === '1';
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
  throw new Error('The browser database is only available on the web-demo dev server');
}
