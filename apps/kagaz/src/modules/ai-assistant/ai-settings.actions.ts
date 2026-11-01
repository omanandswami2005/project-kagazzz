/**
 * AI-callable settings tools (bug-audit fix, F-17/F-18/F-88). Fresh,
 * standalone action definitions — not the same objects as
 * settings.actions.ts's own `settings.setTheme`/`setLanguage`/
 * `setSwipeAction` (those are typed against `SettingsActionContext`, built
 * from SettingsPage-local wiring a separate ChatPage screen can't
 * construct). These reuse the same ids, summaries, and voice phrases for
 * consistency, but their handlers only need the small `AiToolContext` —
 * see ai-navigation.actions.ts's doc comment for the identical reasoning.
 *
 * Bug-audit finding: `docs/design-system/agent-interface.md` states voice
 * commands must resolve through the same Action Registry as any other AI
 * tool call — but `settings.actions.ts` was never registered into
 * `aiToolRegistry` at all (only referenced by SettingsPage's own
 * descriptive `.agent.ts` manifest, not the live tool list the model
 * actually gets). Saying "dark mode" or "switch to hindi" to the
 * assistant silently failed with AGENT_E_UNKNOWN_ACTION, despite
 * SettingsPage.skill.md documenting both as working. `settings.open` is
 * already covered by ai-navigation.actions.ts, so only the three
 * data-changing actions are added here.
 *
 * All three requiresConfirmation: false — reversible UI preferences, no
 * document data touched, same posture as the real settings.actions.ts.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { AiToolContext } from './ai-tools.actions';

const themeSchema = z.enum(['system', 'light', 'dark']);
const languageSchema = z.enum(['en', 'hi']);
const swipeSideSchema = z.enum(['left', 'right']);
const swipeActionSchema = z.enum(['delete', 'favorite', 'move', 'tags', 'archive', 'none']);

export const aiSettingsActions = {
  setTheme: defineAction({
    id: 'settings.setTheme',
    summary:
      "Set the app's colour theme: follow the system setting, always light, or always dark.",
    voice: ['dark mode', 'light mode', 'use system theme', 'डार्क मोड', 'लाइट मोड'],
    args: z.object({ theme: themeSchema }),
    requiresConfirmation: false,
    handler: (
      args: { theme: 'system' | 'light' | 'dark' },
      ctx: AiToolContext
    ): Promise<{ theme: string }> => {
      ctx.setTheme(args.theme);
      return Promise.resolve({ theme: args.theme });
    },
  }),

  setLanguage: defineAction({
    id: 'settings.setLanguage',
    summary: "Switch the app's language between English and Hindi (हिन्दी).",
    voice: [
      'switch to hindi',
      'हिंदी में बदलो',
      'change language to english',
      'अंग्रेज़ी में बदलो',
    ],
    args: z.object({ language: languageSchema }),
    requiresConfirmation: false,
    handler: (
      args: { language: 'en' | 'hi' },
      ctx: AiToolContext
    ): Promise<{ language: string }> => {
      ctx.setLanguage(args.language);
      return Promise.resolve({ language: args.language });
    },
  }),

  setSwipeAction: defineAction({
    id: 'settings.setSwipeAction',
    summary:
      'Choose what happens when a document row is swiped left or right (delete, favorite, move, add tag, archive, or nothing).',
    voice: [
      'swipe left to delete',
      'swipe right to favorite',
      'दस्तावेज़ को स्वाइप करके हटाओ',
    ],
    args: z.object({ side: swipeSideSchema, action: swipeActionSchema }),
    requiresConfirmation: false,
    handler: (
      args: {
        side: 'left' | 'right';
        action: 'delete' | 'favorite' | 'move' | 'tags' | 'archive' | 'none';
      },
      ctx: AiToolContext
    ): Promise<typeof args> => {
      ctx.setSwipeAction(args.side, args.action);
      return Promise.resolve(args);
    },
  }),
};
