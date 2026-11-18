/**
 * Cross-screen routes that carry intent (smart UI plan §4). One place builds
 * them and one place reads them, so a "next action" button on any screen
 * hands off the same way.
 */

/** Query parameter the AI chat reads to pre-attach a document. */
export const ATTACH_PARAM = 'attach';

/** The AI chat with `documentId` already attached ("Ask AI about this"). */
export function askAiAboutRoute(documentId: string): string {
  return `/ai-chat?${ATTACH_PARAM}=${encodeURIComponent(documentId)}`;
}
