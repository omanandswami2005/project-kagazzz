/**
 * settings module Action Registry entries
 * (docs/design-system/agent-interface.md §Layer 2). Voice and AI tool calls
 * open the Settings screen and change the app's colour theme through here.
 * V1 scope: navigation + theme (F-18). Language (F-17), biometric lock (F-16),
 * and density land with their own items.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { SwipeActionKind } from '@/core/gestures';
import type { SupportedLanguage } from '@/core/i18n';
import type { ThemeSetting } from '@/app/providers/ThemeProvider';

/** Capabilities the wired Settings surfaces provide to action handlers. */
export interface SettingsActionContext {
  /** Navigates to the Settings screen. */
  openSettings: () => void;
  /** Applies (and persists) the colour theme. */
  setTheme: (theme: ThemeSetting) => void;
  /** Switches (and persists) the UI language. */
  setLanguage: (language: SupportedLanguage) => void;
  /** Sets which action fires on swipe-left/right over document rows (F-88). */
  setSwipeAction: (side: 'left' | 'right', action: SwipeActionKind) => void;
}

const themeSchema = z.enum(['system', 'light', 'dark']);
const languageSchema = z.enum(['en', 'hi']);
const swipeSideSchema = z.enum(['left', 'right']);
const swipeActionSchema = z.enum(['delete', 'favorite', 'move', 'tags', 'none']);

/** All settings actions, registered by id. */
export const settingsActions = {
  openSettings: defineAction({
    id: 'settings.open',
    summary:
      'Open the app Settings screen (appearance/theme, and — as they ship — language, security, and about).',
    voice: ['open settings', 'settings', 'सेटिंग्स खोलो'],
    args: z.object({}),
    requiresConfirmation: false,
    handler: (
      _args: Record<string, never>,
      ctx: SettingsActionContext
    ): Promise<{ opened: true }> => {
      ctx.openSettings();
      return Promise.resolve({ opened: true });
    },
  }),
  setTheme: defineAction({
    id: 'settings.setTheme',
    summary:
      "Set the app's colour theme: follow the system setting, always light, or always dark.",
    voice: ['dark mode', 'light mode', 'use system theme', 'डार्क मोड', 'लाइट मोड'],
    args: z.object({ theme: themeSchema }),
    requiresConfirmation: false,
    handler: (
      args: { theme: ThemeSetting },
      ctx: SettingsActionContext
    ): Promise<{ theme: ThemeSetting }> => {
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
      args: { language: SupportedLanguage },
      ctx: SettingsActionContext
    ): Promise<{ language: SupportedLanguage }> => {
      ctx.setLanguage(args.language);
      return Promise.resolve({ language: args.language });
    },
  }),
  setSwipeAction: defineAction({
    id: 'settings.setSwipeAction',
    summary:
      'Choose what happens when a document row is swiped left or right (delete, favorite, move, add tag, or nothing).',
    voice: [
      'swipe left to delete',
      'swipe right to favorite',
      'दस्तावेज़ को स्वाइप करके हटाओ',
    ],
    args: z.object({ side: swipeSideSchema, action: swipeActionSchema }),
    requiresConfirmation: false,
    handler: (
      args: { side: 'left' | 'right'; action: SwipeActionKind },
      ctx: SettingsActionContext
    ): Promise<{ side: 'left' | 'right'; action: SwipeActionKind }> => {
      ctx.setSwipeAction(args.side, args.action);
      return Promise.resolve(args);
    },
  }),
};
