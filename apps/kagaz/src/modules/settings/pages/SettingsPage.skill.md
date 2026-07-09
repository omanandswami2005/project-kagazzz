# Skill: settings (Settings)

## Purpose
The user is on the app Settings screen. In V1 it exposes **Appearance → Theme**:
follow the **System** setting, or force **Light** or **Dark**. The choice is
applied immediately and **persists across app restarts**. Language, biometric
lock, density, and About arrive with later items.

## What I (the AI) can do here

| User intent | Action to invoke | Notes / args |
|---|---|---|
| Open settings | `settings.open` | Navigates to `/settings`. |
| Switch theme | `settings.setTheme` | `theme` = `'system'` \| `'light'` \| `'dark'`. |

Tapping a theme button is also a **direct manipulation** — the user can do it by hand.

## Voice examples I should recognize
- "dark mode" / "turn on dark mode" → `settings.setTheme({ theme: 'dark' })`
- "light mode" → `settings.setTheme({ theme: 'light' })`
- "use the system theme" / "match my phone" → `settings.setTheme({ theme: 'system' })`
- "डार्क मोड चालू करो" → `settings.setTheme({ theme: 'dark' })`
- "open settings" / "सेटिंग्स खोलो" → `settings.open`

## State I should check first
- The active theme is on the `settings.theme` group's `data-agent-state`
  (`system` | `light` | `dark`) — read it to confirm a change took effect, and
  to avoid re-selecting the value that is already active.
- `system` resolves to light or dark from the OS; the actual applied palette is
  on `<html data-theme>` (`light` | `dark`).

## Things I must NOT do
- Don't claim a specific colour when the user is on `system` — it follows the OS.
- Don't offer language, biometric lock, or density here yet — those screens/
  controls are not built (F-16, F-17). Say they're coming rather than pretend.

## Cross-page handoffs
- Back returns to `vault.home` (the header back button, `settings.back`).
- The Settings entry point is the gear button on `vault.home` (`vault.home.settings`).
