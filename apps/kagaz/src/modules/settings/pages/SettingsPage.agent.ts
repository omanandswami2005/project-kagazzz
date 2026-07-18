/**
 * Typed page manifest for the Settings screen
 * (docs/design-system/agent-interface.md §Layer 3). Registry actions: change
 * the theme (F-18) and the language (F-17); their results are observable on
 * the `settings.theme` / `settings.language` groups' `data-agent-state`.
 * Security/etc. add their own actions as those items ship.
 */
import { definePage } from '@kagaz/agent-kit';
import { settingsActions } from '../settings.actions';

export const SettingsPageAgent = definePage({
  id: 'settings',
  route: '/settings',
  intent:
    'Change app settings. V1: the UI language (English / हिन्दी) and the colour theme (system / light / dark). Both persist across restarts.',
  surfaces: ['screen'],
  primaryAction: settingsActions.setTheme,
  availableActions: [
    settingsActions.openSettings,
    settingsActions.setTheme,
    settingsActions.setLanguage,
  ],
  observableState: {},
  voiceExamples: [
    { utterance: 'dark mode', action: 'settings.setTheme', args: { theme: 'dark' } },
    { utterance: 'light mode', action: 'settings.setTheme', args: { theme: 'light' } },
    {
      utterance: 'use the system theme',
      action: 'settings.setTheme',
      args: { theme: 'system' },
    },
    { utterance: 'डार्क मोड चालू करो', action: 'settings.setTheme', args: { theme: 'dark' } },
    {
      utterance: 'switch to hindi',
      action: 'settings.setLanguage',
      args: { language: 'hi' },
    },
    {
      utterance: 'अंग्रेज़ी में बदलो',
      action: 'settings.setLanguage',
      args: { language: 'en' },
    },
    { utterance: 'open settings', action: 'settings.open' },
  ],
});
