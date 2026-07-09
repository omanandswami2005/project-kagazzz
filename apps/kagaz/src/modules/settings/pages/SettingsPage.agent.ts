/**
 * Typed page manifest for the Settings screen
 * (docs/design-system/agent-interface.md §Layer 3). Changing the theme is the
 * one registry action here (F-18); its result is observable on the
 * `settings.theme` group's `data-agent-state`. Language/security/etc. add
 * their own actions as those items ship.
 */
import { definePage } from '@kagaz/agent-kit';
import { settingsActions } from '../settings.actions';

export const SettingsPageAgent = definePage({
  id: 'settings',
  route: '/settings',
  intent:
    'Change app settings. V1: the colour theme — follow the system, always light, or always dark. The choice persists across restarts.',
  surfaces: ['screen'],
  primaryAction: settingsActions.setTheme,
  availableActions: [settingsActions.openSettings, settingsActions.setTheme],
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
    { utterance: 'open settings', action: 'settings.open' },
  ],
});
