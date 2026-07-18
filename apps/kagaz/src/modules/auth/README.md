# auth (V1 · Lane E)

App-level biometric/PIN lock, auto-lock on background. Item F-16, SEC-V1.

- Spec: [10-security-architecture.md](../../../../../docs/architecture/10-security-architecture.md) §3
- `[SEC]`: keys live in the platform keystore only — never hardcoded, logged, or stored in JS-reachable storage. The app-lock is an *access* gate layered on the always-on SQLCipher DB encryption; it does not itself hold keys.

## Shipped

- **F-16 App-Level Biometric Lock** (§3.1):
  - `services/biometric.service.ts` — `BiometricAuthenticator` protocol + Capacitor impl (@aparajita/capacitor-biometric-auth) with OS PIN/pattern fallback (`allowDeviceCredential`). Logs only the coarse outcome, never biometric data.
  - `store/lock.store.ts` — enabled/timeout config persisted to localStorage (available pre-DB, synchronous); `locked` state; auto-lock evaluated on foreground vs the timeout.
  - `hooks/useAppLock.ts` — binds the store to `@capacitor/app` `appStateChange` (auto-lock on background) + biometric unlock; `hooks/useLockSettings.ts` drives the Settings controls (enabling requires a successful auth first).
  - `components/LockGate.tsx` + `LockScreen.tsx` — the gate (mounted once in `App.tsx`) renders the lock screen over the app when engaged. **[SEC] the unlock button has no `agentAction`** — the AI/voice layer can never bypass the lock.
  - Settings → Security section (biometric toggle + auto-lock timeout) lives on `SettingsPage`.

## Pending

- Per-document lock (§3.1, independent of app-level lock) — a later item.
- PIN entry as a non-biometric fallback UI (OS credential covers it for now).
