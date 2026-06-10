# auth (V1 · Lane E)

App-level biometric/PIN lock, auto-lock on background, route guarding. Item F-16, SEC-V1.

- Spec: [10-security-architecture.md](../../../../../docs/architecture/10-security-architecture.md) §3
- Structure: `services/` (biometric, pin, auth-guard), `components/` (BiometricPrompt, PinEntry, LockScreen)
- `[SEC]`: keys live in the platform keystore only — never hardcoded, logged, or stored in JS-reachable storage.
