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

/** Options for {@link copyToClipboard}. */
export interface CopyToClipboardOptions {
  /**
   * F-84: clear the clipboard this many ms after a successful copy — bounds
   * how long a sensitive value sits somewhere a keyboard app's clipboard
   * history could surface it. Best-effort: this writes an empty string
   * (there's no clipboard read-back — reading is permission-gated and often
   * blocked once the app loses focus, exactly when a background timer needs
   * it most), guarded by a generation counter so a newer copy always
   * supersedes a pending clear from an older one. Known trade-off (shared by
   * every password-manager-style clipboard-clear feature): if the user
   * copies something else from a *different* app in that window, this timer
   * still clobbers it.
   */
  autoClearMs?: number;
}

/** Writes `text` to the clipboard via the best available API, no side effects. */
async function writeToClipboard(text: string): Promise<boolean> {
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

/** Monotonic token — a newer copy invalidates any pending auto-clear. */
let clearGeneration = 0;

/** Copies `text` to the system clipboard. Returns whether it succeeded. */
export async function copyToClipboard(
  text: string,
  options?: CopyToClipboardOptions
): Promise<boolean> {
  if (!text) {
    return false;
  }
  const ok = await writeToClipboard(text);
  if (!ok) {
    return false;
  }
  clearGeneration += 1;
  if (options?.autoClearMs) {
    const myGeneration = clearGeneration;
    setTimeout(() => {
      if (clearGeneration === myGeneration) {
        void writeToClipboard('');
      }
    }, options.autoClearMs);
  }
  return true;
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
