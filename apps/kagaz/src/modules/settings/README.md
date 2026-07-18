# settings (V1 · Lane E)

App settings: language (hi/en), theme/dark mode, density, accessibility, storage. Items F-17, F-18, F-27.

- Spec: [02-document-vault-module.md](../../../../../docs/architecture/02-document-vault-module.md) §Settings + [12-i18n-multilingual.md](../../../../../docs/architecture/12-i18n-multilingual.md)
- Structure: `components/`, `pages/`, `store/`

## Shipped

- **F-18 Dark Mode** — `pages/SettingsPage.tsx` (+ `.agent.ts` / `.skill.md`): Appearance → Theme control (System / Light / Dark). Reached via the gear button on `vault.home` (`/settings` route). The choice is applied and **persisted by `ThemeProvider`** (localStorage `kagaz:theme`, not the SQLCipher DAO — the provider mounts outside `DatabaseProvider`, and localStorage applies synchronously with no flash). Actions: `settings.open`, `settings.setTheme` (`settings.actions.ts`).

## Pending

- **F-17 Multilingual** — a Language control on this page + full string externalization; unblocks the Hindi step-5 check across the app.
- **F-16 Biometric Lock** `[SEC]` — a Security section + lock screen.
- Density control (the `ThemeProvider` already supports it) and the About section (F-27 / G1-5) slot in as further `<section>`s on `SettingsPage`.
