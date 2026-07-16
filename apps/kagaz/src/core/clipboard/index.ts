/**
 * Clipboard helper (F-68).
 *
 * Prefers the async Clipboard API — it works inside the Capacitor Android
 * WebView, which runs in a secure context (`capacitor://`) — and falls back to
 * a hidden-textarea + `execCommand('copy')` for older WebViews where the async
 * API is unavailable or blocked.
 *
 * [SEC] The copied text may be document / OCR content (PII), so it is never
 * logged here — callers pass it straight to the platform clipboard.
 */

/** Copies `text` to the system clipboard. Returns whether it succeeded. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) {
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Async API present but rejected (permission / focus) — try the legacy path.
    }
  }
  return copyViaTextarea(text);
}

/** Legacy fallback: select a hidden textarea and run the copy command. */
function copyViaTextarea(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Keep it out of view and unfocusable-scrolling while still selectable.
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
