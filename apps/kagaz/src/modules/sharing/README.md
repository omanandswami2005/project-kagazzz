# sharing (V2 — do not import from V1 modules' code)

Encrypted TTL share links, access codes, consent, share management. Items F-46–48, F-52–54, F-59–62.

- Spec: [06-sharing-module.md](../../../../../docs/architecture/06-sharing-module.md) + [10-security-architecture.md](../../../../../docs/architecture/10-security-architecture.md) §4
- Structure: `services/`, `components/`, `pages/`
- `[LEGAL]` `[CONSENT]` by default: consent screens use exact copy from [consent-screens.md](../../../../../docs/ux/consent-screens.md); every share action is consent-logged.
- V1 builds must never load this module (version dependency rule).
