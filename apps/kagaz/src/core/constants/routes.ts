/**
 * Cross-screen routes that carry intent (smart UI plan §4). One place builds
 * them and one place reads them, so a "next action" button on any screen
 * hands off the same way.
 */

/** Query parameter the AI chat reads to pre-attach a document. */
export const ATTACH_PARAM = 'attach';

/** Query parameter the AI chat reads to pre-fill (not send) a message. */
export const ASK_PARAM = 'ask';

/** The AI chat with `text` waiting in the composer (audit VH-13). */
export function askAiRoute(text: string): string {
  return `/ai-chat?${ASK_PARAM}=${encodeURIComponent(text)}`;
}

/** The AI chat with `documentId` already attached ("Ask AI about this"). */
export function askAiAboutRoute(documentId: string): string {
  return `/ai-chat?${ATTACH_PARAM}=${encodeURIComponent(documentId)}`;
}
