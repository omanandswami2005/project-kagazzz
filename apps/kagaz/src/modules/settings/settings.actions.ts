/**
 * settings module Action Registry entries
 * (docs/design-system/agent-interface.md §Layer 2). Voice and AI tool calls
 * open the Settings screen and change the app's colour theme through here.
 * V1 scope: navigation + theme (F-18). Language (F-17), biometric lock (F-16),
 * and density land with their own items.
 */
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import type { ThemeSetting } from '@/app/providers/ThemeProvider';

/** Capabilities the wired Settings surfaces provide to action handlers. */
export interface SettingsActionContext {
  /** Navigates to the Settings screen. */
  openSettings: () => void;
  /** Applies (and persists) the colour theme. */
  setTheme: (theme: ThemeSetting) => void;
}

const themeSchema = z.enum(['system', 'light', 'dark']);

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
};
