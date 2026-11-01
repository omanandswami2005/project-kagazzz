# Skill: settings (Settings)

## Purpose
The user is on the app Settings screen. In V1 it exposes **Language**
(English / हिन्दी), **Appearance → Theme** (System / Light / Dark),
**Documents → Swipe actions** (what swipe-left/swipe-right do on a document
row, F-88), and **Security → Biometric lock** (with an auto-lock timeout).
Changes apply immediately and persist. Density and About arrive with later
items.

## What I (the AI) can do here

| User intent | Action to invoke | Notes / args |
|---|---|---|
| Open settings | `settings.open` | Navigates to `/settings`. |
| Switch language | `settings.setLanguage` | `language` = `'en'` \| `'hi'`. |
| Switch theme | `settings.setTheme` | `theme` = `'system'` \| `'light'` \| `'dark'`. |
| Set a swipe action | `settings.setSwipeAction` | `side` = `'left'` \| `'right'`, `action` = `'delete'` \| `'favorite'` \| `'move'` \| `'tags'` \| `'none'`. |

Tapping a language/theme/swipe-action button is also a **direct manipulation** — the user can do it by hand.

## Voice examples I should recognize
- "switch to hindi" / "हिंदी में बदलो" → `settings.setLanguage({ language: 'hi' })`
- "change language to english" / "अंग्रेज़ी में बदलो" → `settings.setLanguage({ language: 'en' })`
- "dark mode" / "turn on dark mode" → `settings.setTheme({ theme: 'dark' })`
- "light mode" → `settings.setTheme({ theme: 'light' })`
- "use the system theme" / "match my phone" → `settings.setTheme({ theme: 'system' })`
- "डार्क मोड चालू करो" → `settings.setTheme({ theme: 'dark' })`
- "open settings" / "सेटिंग्स खोलो" → `settings.open`
- "swipe left to delete" → `settings.setSwipeAction({ side: 'left', action: 'delete' })`
- "swipe right to favorite" → `settings.setSwipeAction({ side: 'right', action: 'favorite' })`

## State I should check first
- The active language is on the `settings.language` group's `data-agent-state`
  (`en` | `hi`); the active theme is on `settings.theme` (`system` | `light` |
  `dark`). Read them to confirm a change took effect and to avoid re-selecting
  the value that is already active.
- `system` resolves to light or dark from the OS; the actual applied palette is
  on `<html data-theme>` (`light` | `dark`).
- The active swipe actions are on `settings.swipe-left`/`settings.swipe-right`
  group `data-agent-state` (one of `delete` | `favorite` | `move` | `tags` |
  `none`).

## Things I must NOT do
- Don't claim a specific colour when the user is on `system` — it follows the OS.
- **Never enable/disable the biometric lock or unlock the app on the user's
  behalf.** [SEC] The Security toggle and the lock screen are user-only direct
  manipulations with no registry action, so the AI cannot bypass the lock.
- Don't offer a density control here yet — not built. Say it's coming.

## Cross-page handoffs
- Back returns to `vault.home` (the header back button, `settings.back`).
- The Settings entry point is the gear button on `vault.home` (`vault.home.settings`).
