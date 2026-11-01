/**
 * AI-callable navigation tools (F-23, 05-ai-assistant-module.md §4.2).
 * Fresh, standalone action definitions — not the same objects as
 * vault.actions.ts/settings.actions.ts/pdf-tools.actions.ts's own
 * `vault.openQuickReference`/`settings.open`/`tools.openPdfTools` (those are
 * typed against their own module's much larger action-context interfaces,
 * e.g. `VaultActionContext` also covers upload/sort/tag/folder mutations
 * ChatPage has no way to construct). These reuse the same ids, summaries,
 * and voice phrases for consistency, but their handlers only need a
 * router — see `AiToolContext` in ai-tools.actions.ts — so useChat.ts can
 * build a real implementation with nothing but `useIonRouter()`.
 *
 * Deliberately pure navigation only, `requiresConfirmation: false` for all
 * five — nothing here mutates data.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { AiToolContext } from './ai-tools.actions';

export const aiNavigationActions = {
  openQuickReference: defineAction({
    id: 'vault.openQuickReference',
    summary:
      'Open Quick Reference, the personal saved-values screen (PAN, mobile, bank account, etc.).',
    voice: ['open quick reference', 'show my saved numbers', 'क्विक रेफरेंस खोलो'],
    args: z.object({}),
    requiresConfirmation: false,
    handler: (_args: unknown, ctx: AiToolContext): Promise<{ opened: true }> => {
      ctx.openQuickReference();
      return Promise.resolve({ opened: true });
    },
  }),

  openQuickNotes: defineAction({
    id: 'vault.openQuickNotes',
    summary: 'Open Quick Notes, the fast, gate-free personal notes screen for non-sensitive data.',
    voice: ['open quick notes', 'show my notes', 'क्विक नोट्स खोलो'],
    args: z.object({}),
    requiresConfirmation: false,
    handler: (_args: unknown, ctx: AiToolContext): Promise<{ opened: true }> => {
      ctx.openQuickNotes();
      return Promise.resolve({ opened: true });
    },
  }),

  startQuickNote: defineAction({
    id: 'vault.startQuickNote',
    summary:
      'Open Quick Notes with the add-note composer already open, ready to type a title and value.',
    voice: ['take a quick note', 'add a quick note', 'एक क्विक नोट लिखो'],
    args: z.object({}),
    requiresConfirmation: false,
    handler: (_args: unknown, ctx: AiToolContext): Promise<{ opened: true }> => {
      ctx.startQuickNote();
      return Promise.resolve({ opened: true });
    },
  }),

  openSettings: defineAction({
    id: 'settings.open',
    summary:
      'Open the app Settings screen (appearance/theme, language, security, and about).',
    voice: ['open settings', 'settings', 'सेटिंग्स खोलो'],
    args: z.object({}),
    requiresConfirmation: false,
    handler: (_args: unknown, ctx: AiToolContext): Promise<{ opened: true }> => {
      ctx.openSettings();
      return Promise.resolve({ opened: true });
    },
  }),

  openPdfTools: defineAction({
    id: 'tools.openPdfTools',
    summary:
      'Open the PDF Tools hub to merge, split, compress, convert PDFs and images, watermark a PDF, password-protect/unlock a PDF, or fill a PDF form.',
    voice: ['open pdf tools', 'merge pdfs', 'split a pdf', 'पीडीएफ़ उपकरण खोलो'],
    args: z.object({}),
    requiresConfirmation: false,
    handler: (_args: unknown, ctx: AiToolContext): Promise<{ opened: true }> => {
      ctx.openPdfTools();
      return Promise.resolve({ opened: true });
    },
  }),
};
