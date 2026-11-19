/**
 * Cross-screen routes that carry intent (smart UI plan §4). One place builds
 * them and one place reads them, so a "next action" button on any screen
 * hands off the same way.
 */

/** Query parameter the AI chat reads to pre-attach a document. */
export const ATTACH_PARAM = 'attach';

/** Query parameters the PDF Tools hub reads to open one tool on one document. */
export const TOOL_PARAM = 'tool';
export const DOC_PARAM = 'doc';

/** A PDF tool opened with `documentId` already selected (audit VW-8, TS-9). */
export function pdfToolRoute(toolId: string, documentId: string): string {
  return `/pdf-tools?${TOOL_PARAM}=${encodeURIComponent(toolId)}&${DOC_PARAM}=${encodeURIComponent(documentId)}`;
}

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
