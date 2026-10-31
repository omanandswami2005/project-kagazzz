/**
 * The single online/offline switch for AI. Offline = on-device (or a local
 * server in demo builds); online = Google Vertex AI through the demo proxy.
 * Online is only selectable when the build has the proxy (`VITE_CLOUD_AI`).
 *
 * [SEC] Online sends messages — and any document the user asks the assistant
 * to transcribe — to Google Cloud. The UI must warn and get an explicit yes
 * before calling {@link setAiMode}('online'); this module only stores the choice.
 */

export type AiMode = 'offline' | 'online';

const STORAGE_KEY = 'kagaz:ai-mode';
const listeners = new Set<(mode: AiMode) => void>();

/** True when this build ships the cloud proxy (demo builds only). */
export function isCloudAiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CLOUD_AI);
}

/** The persisted mode; always `offline` when online is not available in this build. */
export function getAiMode(): AiMode {
  if (!isCloudAiConfigured()) {
    return 'offline';
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === 'online' ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

export function setAiMode(mode: AiMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private mode / quota — the choice just won't persist across reloads.
  }
  listeners.forEach((listener) => listener(mode));
}

/** Subscribe to mode changes; returns an unsubscribe function. */
export function onAiModeChange(listener: (mode: AiMode) => void): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}

/** True when AI calls should go to the cloud right now. */
export function isOnline(): boolean {
  return getAiMode() === 'online';
}
